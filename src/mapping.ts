import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { UniswapV2Pair } from "../generated/LandWolf/UniswapV2Pair"; // Update ABI import
import {
  LandWolf,
  Transfer as TransferEvent,
  Approval as ApprovalEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
} from "../generated/LandWolf/LandWolf";
import {
  Token,
  Account,
  Transfer,
  Approval,
  DailyMetric,
  FeeUpdate,
  OwnershipTransferred,
  TokenAcquisition,
} from "../generated/schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());
  if (!token) {
    let contract = LandWolf.bind(address);
    token = new Token(address.toHexString());
    token.name = "Landwolf";
    token.symbol = "Wolf";
    token.decimals = 18;
    token.totalSupply = BigInt.fromString("420690000000000000000000000");
    token.tradingEnabled = false;
    token.maxTxAmount = contract._maxTxAmount();
    token.maxWalletSize = contract._maxWalletSize();
    token.currentOwner = contract.owner();
    token.holderCount = BigInt.fromI32(0);
    token.totalTransactions = BigInt.fromI32(0);
    token.totalVolume = BigInt.fromI32(0);
    token.totalVolumeEth = BigInt.fromI32(0);
    token.save();
  }
  return token;
}

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHexString());
  if (!account) {
    account = new Account(address.toHexString());
    account.balance = BigInt.fromI32(0);
    account.isBot = false;
    account.isBotGuarded = false;
    account.isExcludedFromFee = false;
    account.lastTransactionTimestamp = null;
    account.initialDistributionAmount = BigInt.fromI32(0);
    account.totalReceivedAmount = BigInt.fromI32(0);
    account.totalBoughtAmount = BigInt.fromI32(0);
    account.isInitialDistributionReceiver = false;
    account.totalBuyVolume = BigInt.fromI32(0);
    account.totalSellVolume = BigInt.fromI32(0);
    account.save();
  }
  return account;
}

function getOrCreateDailyMetric(timestamp: BigInt): DailyMetric {
  let dayID = timestamp.div(BigInt.fromI32(86400)).toString();
  let metric = DailyMetric.load(dayID);
  if (!metric) {
    metric = new DailyMetric(dayID);
    let date = new Date(timestamp.toI64() * 1000);
    metric.date = date.toISOString().split("T")[0];
    metric.totalTransfers = BigInt.fromI32(0);
    metric.volume = BigInt.fromI32(0);
    metric.volumeEth = BigInt.fromI32(0);
    metric.uniqueWallets = BigInt.fromI32(0);
    metric.buyCount = BigInt.fromI32(0);
    metric.sellCount = BigInt.fromI32(0);
    metric.save();
  }
  return metric;
}

function calculateEthValue(tokenAmount: BigInt, pair: UniswapV2Pair): BigInt {
  let reserves = pair.try_getReserves();
  if (reserves.reverted) {
    return BigInt.fromI32(0);
  }

  let tokenReserve = reserves.value.value0;
  let ethReserve = reserves.value.value1;

  if (tokenReserve.equals(BigInt.fromI32(0))) {
    return BigInt.fromI32(0);
  }

  return tokenAmount.times(ethReserve).div(tokenReserve);
}

export function handleTransfer(event: TransferEvent): void {
  let token = getOrCreateToken(event.address);
  let from = getOrCreateAccount(event.params.from);
  let to = getOrCreateAccount(event.params.to);
  let contract = LandWolf.bind(event.address);
  let uniswapPair = contract.uniswapV2Pair();

  // Update balances
  from.balance = from.balance.minus(event.params.value);
  to.balance = to.balance.plus(event.params.value);

  // Update timestamps
  from.lastTransactionTimestamp = event.block.timestamp;
  to.lastTransactionTimestamp = event.block.timestamp;

  // Create Transfer entity
  let transfer = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  transfer.from = from.id;
  transfer.to = to.id;
  transfer.value = event.params.value;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.isBuy = event.params.from.toHexString() == uniswapPair.toHexString();
  transfer.isSell = event.params.to.toHexString() == uniswapPair.toHexString();

  // Handle ETH value for swaps
  if (transfer.isBuy || transfer.isSell) {
    let pair = UniswapV2Pair.bind(uniswapPair);
    let ethValue = calculateEthValue(event.params.value, pair);
    transfer.ethValue = ethValue;

    // Update metrics
    if (transfer.isBuy) {
      to.totalBuyVolume = to.totalBuyVolume.plus(event.params.value);
      to.totalBoughtAmount = to.totalBoughtAmount.plus(event.params.value);
    } else {
      from.totalSellVolume = from.totalSellVolume.plus(event.params.value);
    }

    // Update daily metrics
    let metric = getOrCreateDailyMetric(event.block.timestamp);
    if (transfer.isBuy) {
      metric.buyCount = metric.buyCount.plus(BigInt.fromI32(1));
    } else {
      metric.sellCount = metric.sellCount.plus(BigInt.fromI32(1));
    }
    metric.volumeEth = metric.volumeEth.plus(ethValue);
    token.totalVolumeEth = token.totalVolumeEth.plus(ethValue);
  }

  // Handle acquisition tracking
  let acquisition = new TokenAcquisition(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  acquisition.account = to.id;
  acquisition.amount = event.params.value;
  acquisition.from = from.id;
  acquisition.timestamp = event.block.timestamp;
  acquisition.blockNumber = event.block.number;
  acquisition.transactionHash = event.transaction.hash;
  acquisition.ethValue = transfer.ethValue || BigInt.fromI32(0);

  if (from.id == token.id) {
    acquisition.acquisitionType = "INITIAL_DISTRIBUTION";
    to.isInitialDistributionReceiver = true;
    to.initialDistributionAmount = to.initialDistributionAmount.plus(
      event.params.value
    );
  } else if (transfer.isBuy) {
    acquisition.acquisitionType = "BOUGHT";
  } else {
    acquisition.acquisitionType = "RECEIVED_TRANSFER";
    to.totalReceivedAmount = to.totalReceivedAmount.plus(event.params.value);
  }

  // Update metrics
  let metric = getOrCreateDailyMetric(event.block.timestamp);
  metric.totalTransfers = metric.totalTransfers.plus(BigInt.fromI32(1));
  metric.volume = metric.volume.plus(event.params.value);
  token.totalVolume = token.totalVolume.plus(event.params.value);
  token.totalTransactions = token.totalTransactions.plus(BigInt.fromI32(1));

  // Save all entities
  acquisition.save();
  transfer.save();
  from.save();
  to.save();
  token.save();
  metric.save();
}

export function handleApproval(event: ApprovalEvent): void {
  let owner = getOrCreateAccount(event.params.owner);
  let spender = getOrCreateAccount(event.params.spender);

  let approval = new Approval(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  approval.owner = owner.id;
  approval.spender = spender.id;
  approval.value = event.params.value;
  approval.timestamp = event.block.timestamp;
  approval.blockNumber = event.block.number;
  approval.transactionHash = event.transaction.hash;

  approval.save();
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let token = getOrCreateToken(event.address);
  token.currentOwner = event.params.newOwner;
  token.save();

  let transfer = new OwnershipTransferred(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  transfer.previousOwner = event.params.previousOwner;
  transfer.newOwner = event.params.newOwner;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}

export function handleSetTrading(call: ethereum.Call): void {
  let token = getOrCreateToken(call.to);
  token.tradingEnabled = call.inputValues[0].value.toBoolean();
  token.save();
}

export function handleSetFee(call: ethereum.Call): void {
  let feeUpdate = new FeeUpdate(
    call.transaction.hash.concatI32(call.transaction.index.toI32())
  );
  feeUpdate.timestamp = call.block.timestamp;
  feeUpdate.redisFeeOnBuy = call.inputValues[0].value.toBigInt();
  feeUpdate.redisFeeOnSell = call.inputValues[1].value.toBigInt();
  feeUpdate.taxFeeOnBuy = call.inputValues[2].value.toBigInt();
  feeUpdate.taxFeeOnSell = call.inputValues[3].value.toBigInt();
  feeUpdate.blockNumber = call.block.number;
  feeUpdate.save();
}

export function handleBlockBots(call: ethereum.Call): void {
  let addresses = call.inputValues[0].value.toAddressArray();
  for (let i = 0; i < addresses.length; i++) {
    let account = getOrCreateAccount(addresses[i]);
    account.isBot = true;
    account.save();
  }
}

export function handleUnblockBot(call: ethereum.Call): void {
  let account = getOrCreateAccount(call.inputValues[0].value.toAddress());
  account.isBot = false;
  account.save();
}
