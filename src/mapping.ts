import { BigInt, Address, ethereum, log } from "@graphprotocol/graph-ts";
import {
  LandWolf,
  Transfer as TransferEvent,
  Approval as ApprovalEvent,
  OwnershipTransferred as OwnershipTransferredEvent
} from "../generated/LandWolf/LandWolf";
import { UniswapV2Pair } from "../generated/LandWolf/UniswapV2Pair";
import {
  Token,
  Account,
  Transfer,
  Approval,
  DailyMetric,
  TokenAcquisition,
  FeeUpdate,
  OwnershipTransferred
} from "../generated/schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());
  if (!token) {
    token = new Token(address.toHexString());
    let contract = LandWolf.bind(address);
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

function getOrCreateAccount(address: Address, contract: LandWolf): Account {
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
  }

  // Just use balanceOf() - it handles the reflection conversion internally
  let balanceResult = contract.try_balanceOf(address);
  if (!balanceResult.reverted) {
    account.balance = balanceResult.value;
  }

  return account;
}

function updateAccountBalance(account: Account, address: Address, contract: LandWolf, timestamp: BigInt): void {
  let balanceCall = contract.try_balanceOf(address);
  if (!balanceCall.reverted) {
    account.balance = balanceCall.value;
    account.lastTransactionTimestamp = timestamp;
    account.save();
  }
}

function calculateEthValue(tokenAmount: BigInt, pairAddress: Address): BigInt {
  let pair = UniswapV2Pair.bind(pairAddress);
  let reservesResult = pair.try_getReserves();
  
  if (!reservesResult.reverted) {
    let reserves = reservesResult.value;
    let tokenReserves = reserves.get_reserve0();
    let ethReserves = reserves.get_reserve1();
    
    if (!tokenReserves.isZero()) {
      return tokenAmount.times(ethReserves).div(tokenReserves);
    }
  }
  
  return BigInt.fromI32(0);
}

export function handleTransfer(event: TransferEvent): void {
  let contract = LandWolf.bind(event.address);
  
  // Get accounts
  let from = getOrCreateAccount(event.params.from, contract);
  let to = getOrCreateAccount(event.params.to, contract);
  
  // Update balances - the balanceOf() call will give us the actual token amounts
  let fromBalance = contract.try_balanceOf(event.params.from);
  let toBalance = contract.try_balanceOf(event.params.to);
  
  if (!fromBalance.reverted) {
    from.balance = fromBalance.value;
    from.lastTransactionTimestamp = event.block.timestamp;
  }
  
  if (!toBalance.reverted) {
    to.balance = toBalance.value;
    to.lastTransactionTimestamp = event.block.timestamp;
  }
  
  // Save everything
  from.save();
  to.save();
}
export function handleApproval(event: ApprovalEvent): void {
  let approval = new Approval(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  approval.owner = event.params.owner.toHexString();
  approval.spender = event.params.spender.toHexString();
  approval.value = event.params.value;
  approval.timestamp = event.block.timestamp;
  approval.blockNumber = event.block.number;
  approval.transactionHash = event.transaction.hash;
  approval.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
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
  let feeUpdate = new FeeUpdate(call.transaction.hash.concatI32(call.transaction.index.toI32()));
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
    let contract = LandWolf.bind(call.to);
    let account = getOrCreateAccount(addresses[i], contract);
    account.isBot = true;
    account.save();
  }
}

export function handleUnblockBot(call: ethereum.Call): void {
  let contract = LandWolf.bind(call.to);
  let account = getOrCreateAccount(call.inputValues[0].value.toAddress(), contract);
  account.isBot = false;
  account.save();
}