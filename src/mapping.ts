

//src/mapping.ts
import {
  LandWolf,
  SetTradingCall,
  SetFeeCall,
  BlockBotsCall,
  UnblockBotCall,
  ExcludeMultipleAccountsFromFeesCall,
  SetMaxWalletSizeCall
} from "../generated/LandWolf/LandWolf"


import { BigInt, BigDecimal, Address, ethereum } from "@graphprotocol/graph-ts"
import { TokenAnalyzer, TokenBalances } from './tokenAnalyzer'
import { Account, Transaction, Token, BalanceSnapshot, ReflectionRate, FeeUpdate,AddressTracking  } from "../generated/schema"
import { EXCLUDED_ADDRESSES, TOKEN_ADDRESS } from './utils/constants'
import { BalanceVerifier } from './utils/balance-verifier'
import { TOKEN_ADDRESS, EXCLUDED_ADDRESSES } from "./utils/constants";

function initializeToken(address: Address): Token {
  let token = new Token(address.toHexString())
  let contract = TokenContract.bind(address)
  
  token.name = "Landwolf"
  token.symbol = "Wolf"
  token.decimals = 18
  token.totalSupply = BigInt.fromString("420690000000000000000000000")
  token.totalFees = BigInt.fromI32(0)
  token.transferCount = BigInt.fromI32(0)
  token.txCount = BigInt.fromI32(0)
  token.currentRate = BigInt.fromI32(0)
  token.maxTxAmount = BigInt.fromI32(0)
  token.maxWalletSize = BigInt.fromI32(0)
  token.tradingEnabled = false
  token.redisFeeOnBuy = BigInt.fromI32(0)
  token.redisFeeOnSell = BigInt.fromI32(0)
  token.taxFeeOnBuy = BigInt.fromI32(0)
  token.taxFeeOnSell = BigInt.fromI32(0)
  token.lastUpdateBlock = BigInt.fromI32(0)
  
  return token
}


function loadOrCreateAccount(address: Address, token: Token): Account {
  let account = Account.load(address.toHexString())
  if (!account) {
    account = new Account(address.toHexString())
    account.token = token.id
    account.balance = BigInt.fromI32(0)
    account.rBalance = BigInt.fromI32(0)
    account.isExcluded = isExcluded(address)
    account.isBlocked = false
    account.lastUpdateBlock = BigInt.fromI32(0)
    account.lastUpdateRate = BigInt.fromI32(0)
    account.percentageOwned = BigDecimal.fromString("0")
    account.formattedBalance = BigDecimal.fromString("0")
  }
  return account as Account
}

function updateAccountBalances(account: Account, balances: TokenBalances): void {
  account.balance = balances.balance
  account.rBalance = balances.rBalance
  account.formattedBalance = balances.formattedBalance
  
  // Calculate percentage owned
  let totalSupply = BigInt.fromString("420690000000000000000000000")
  account.percentageOwned = account.balance
    .toBigDecimal()
    .div(totalSupply.toBigDecimal())
    .times(BigDecimal.fromString("100"))
    
  // Verify balance against known values
  if (!BalanceVerifier.verifyBalance(account.id, account.formattedBalance)) {
    log.warning(
      'Balance verification failed for account {}. Expected: {}, Got: {}',
      [account.id, BalanceVerifier.getKnownBalance(account.id), account.formattedBalance.toString()]
    )
  }
}

function createBalanceSnapshot(
  account: Account,
  balance: BigInt,
  rate: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  let snapshot = new BalanceSnapshot(
    account.id + "-" + blockNumber.toString()
  )
  snapshot.account = account.id
  snapshot.balance = balance
  snapshot.rate = rate
  snapshot.blockNumber = blockNumber
  snapshot.timestamp = timestamp
  snapshot.save()
}

function isExcluded(address: Address): boolean {
  let addressStr = address.toHexString().toLowerCase()
  return EXCLUDED_ADDRESSES.includes(addressStr)
}

export function handleTransfer(event: Transfer): void {
  let token = Token.load(event.address.toHexString())
  if (!token) {
    token = initializeToken(event.address)
  }
  
  let contract = TokenContract.bind(event.address)
  let features = TokenAnalyzer.analyzeFeatures(event.address)
  
  // Get and update accounts
  let fromAccount = loadOrCreateAccount(event.params.from, token)
  let toAccount = loadOrCreateAccount(event.params.to, token)
  
  // Update balances using TokenAnalyzer
  let fromBalances = TokenAnalyzer.updateAccountBalances(contract, event.params.from)
  let toBalances = TokenAnalyzer.updateAccountBalances(contract, event.params.to)

  // Track this address for future periodic updates
  trackAddress(event.params.from, token)
  trackAddress(event.params.to, token)

  updateAccountBalances(fromAccount, fromBalances)
  updateAccountBalances(toAccount, toBalances)
  
  // Create transaction record
  let transaction = new Transaction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  transaction.token = token.id
  transaction.from = fromAccount.id
  transaction.to = toAccount.id
  transaction.value = event.params.value
  transaction.reflectionValue = BigInt.fromI32(0) // Initialize
  transaction.feeAmount = BigInt.fromI32(0)      // Initialize
  transaction.redisFee = BigInt.fromI32(0)       // Initialize
  transaction.taxFee = BigInt.fromI32(0)         // Initialize
  transaction.dexPair = ""                       // Initialize
  transaction.priceInETH = BigDecimal.fromString("0") // Initialize
  transaction.transferType = TokenAnalyzer.getTransferType(
    event.params.from,
    event.params.to,
    features
  )
  
  if (features.hasReflection) {
    let currentRate = TokenAnalyzer.getCurrentRate(contract)
    transaction.reflectionValue = event.params.value.times(currentRate)
    
    // Create reflection rate record
    let reflectionRate = new ReflectionRate(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    )
    reflectionRate.token = token.id
    reflectionRate.rate = currentRate
    reflectionRate.block = event.block.number
    reflectionRate.timestamp = event.block.timestamp
    reflectionRate.save()
    
    // Create balance snapshots
    createBalanceSnapshot(
      fromAccount, 
      fromBalances.balance, 
      currentRate, 
      event.block.number, 
      event.block.timestamp
    )
    createBalanceSnapshot(
      toAccount, 
      toBalances.balance, 
      currentRate, 
      event.block.number, 
      event.block.timestamp
    )
  }
  
  // Update transaction metadata
  transaction.timestamp = event.block.timestamp
  transaction.block = event.block.number
  transaction.transactionHash = event.transaction.hash.toHexString()
  
  // Update token stats
  token.transferCount = token.transferCount.plus(BigInt.fromI32(1))
  token.txCount = token.txCount.plus(BigInt.fromI32(1))
  token.lastUpdateBlock = event.block.number
  
  // Save all entities
  token.save()
  fromAccount.save()
  toAccount.save()
  transaction.save()
}

function trackAddress(address: Address, token: Token): void {
    let trackingList = AddressTracking.load(token.id + "-tracked")
    if (!trackingList) {
        trackingList = new AddressTracking(token.id + "-tracked")
        trackingList.addresses = []
    }
    
    if (!trackingList.addresses.includes(address.toHexString())) {
        let newAddresses = trackingList.addresses
        newAddresses.push(address.toHexString())
        trackingList.addresses = newAddresses
        trackingList.save()
    }
}

export function handleMaxTxAmountUpdated(event: MaxTxAmountUpdated): void {
  let token = Token.load(event.address.toHexString())
  if (token) {
    token.maxTxAmount = event.params._maxTxAmount
    token.save()
  }
}


export function handleSetTrading(call: SetTradingCall): void {
  let token = Token.load(call.to.toHexString())
  if (token) {
    token.tradingEnabled = call.inputs._tradingOpen
    token.save()
  }
}


export function handleSetFee(call: SetFeeCall): void {
  let token = Token.load(call.to.toHexString())
  if (token) {
    token.redisFeeOnBuy = call.inputs.redisFeeOnBuy
    token.redisFeeOnSell = call.inputs.redisFeeOnSell
    token.taxFeeOnBuy = call.inputs.taxFeeOnBuy
    token.taxFeeOnSell = call.inputs.taxFeeOnSell
    token.save()

    let feeUpdate = new FeeUpdate(call.transaction.hash.toHexString())
    feeUpdate.token = token.id
    feeUpdate.redisFeeOnBuy = call.inputs.redisFeeOnBuy
    feeUpdate.redisFeeOnSell = call.inputs.redisFeeOnSell
    feeUpdate.taxFeeOnBuy = call.inputs.taxFeeOnBuy
    feeUpdate.taxFeeOnSell = call.inputs.taxFeeOnSell
    feeUpdate.timestamp = call.block.timestamp
    feeUpdate.block = call.block.number
    feeUpdate.save()
  }
}

export function handleBlockBots(call: BlockBotsCall): void {
  let bots = call.inputs.bots_
  for (let i = 0; i < bots.length; i++) {
    let account = Account.load(bots[i].toHexString())
    if (account) {
      account.isBlocked = true
      account.save()
    }
  }
}

export function handleUnblockBot(call: UnblockBotCall): void {
  let account = Account.load(call.inputs.notbot.toHexString())
  if (account) {
    account.isBlocked = false
    account.save()
  }
}

export function handleExcludeFromFees(call: ExcludeMultipleAccountsFromFeesCall): void {
  let accounts = call.inputs.accounts
  let excluded = call.inputs.excluded
  
  for (let i = 0; i < accounts.length; i++) {
    let account = Account.load(accounts[i].toHexString())
    if (account) {
      account.isExcluded = excluded
      account.save()
    }
  }
}

function updateHolderBalances(token: Token, block: ethereum.Block): void {
  let contract = TokenContract.bind(Address.fromString(token.id))
  let features = TokenAnalyzer.analyzeFeatures(Address.fromString(token.id))
  
  // Get all accounts that have had transactions
  // This is more efficient than checking every address on the blockchain
  let accounts = Account.load(token.id + "-holders")
  if (!accounts) return
  
  // Batch update in groups of 100 to avoid timeout
  let skip = 0
  let batchSize = 100
  
  while (skip < accounts.length) {
      let batch = accounts.slice(skip, skip + batchSize)
      for (let i = 0; i < batch.length; i++) {
          let account = Account.load(batch[i])
          if (account && !account.isBlocked) {
              // Only update if last update was more than 100 blocks ago
              if (account.lastUpdateBlock.plus(BigInt.fromI32(100)).lt(block.number)) {
                  let balances = TokenAnalyzer.updateAccountBalances(contract, Address.fromString(account.id))
                  updateAccountBalances(account, balances)
                  account.save()
              }
          }
      }
      skip += batchSize
  }
  
  // Update token's last check block
  token.lastUpdateBlock = block.number
  token.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let token = Token.load(event.address.toHexString())
  if (!token) {
      token = initializeToken(event.address)
  }
  
  // Create a transaction record for ownership transfer
  let transaction = new Transaction(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  transaction.token = token.id
  transaction.from = event.params.previousOwner.toHexString()
  transaction.to = event.params.newOwner.toHexString()
  transaction.value = BigInt.fromI32(0)
  transaction.transferType = "OWNERSHIP_TRANSFER"
  transaction.timestamp = event.block.timestamp
  transaction.block = event.block.number
  transaction.transactionHash = event.transaction.hash.toHexString()
  
  transaction.save()
}

export function handleBlock(block: ethereum.Block): void {
  let token = Token.load(TOKEN_ADDRESS)
  if (token && block.number.mod(BigInt.fromI32(100)).equals(BigInt.fromI32(0))) {
    updateHolderBalances(token, block)
  }
}


