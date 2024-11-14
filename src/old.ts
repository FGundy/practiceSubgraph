// function determineTransferType(
//     event: Transfer,
//     contract: TokenContract
//   ): TransferType {
//     let dexPairs = new Set<string>([
//       "0x...", // Add your known DEX pair addresses
//     ]);
    
//     let from = event.params.from.toHexString().toLowerCase();
//     let to = event.params.to.toHexString().toLowerCase();
    
//     // Check if transfer involves a DEX pair
//     if (dexPairs.has(from)) {
//       return "BUY";
//     } else if (dexPairs.has(to)) {
//       return "SELL";
//     } else if (from == "0x0000000000000000000000000000000000000000") {
//       return "INITIAL_DISTRIBUTION";
//     }
    
//     return "TRANSFER";
//   }
// function getCurrentRate(contract: TokenContract): BigInt {
//     // Calculate current rate using same logic as contract
//     let rSupply = contract.try_getCurrentSupply()
//     if (!rSupply.reverted) {
//       return rSupply.value.value0.div(rSupply.value.value1)
//     }
//     return BigInt.fromI32(0)
//   }
//   function formatBalance(balance: BigInt): BigDecimal {
//     return balance.toBigDecimal().div(BigDecimal.fromString("1000000000000000000")) // 18 decimals
//   }
  





// import { 
//   Transfer,
//   Token as TokenContract,
//   MaxTxAmountUpdated,
//   OwnershipTransferred
// } from "../generated/LandWolf/LandWolf"
// import { BigInt, BigDecimal, Address, ethereum } from "@graphprotocol/graph-ts"
// import { TokenAnalyzer } from './tokenAnalyzer'
// import { Account, Transaction, Token, BalanceSnapshot, ReflectionRate } from "../generated/schema"

// const TOKEN_ADDRESS = "0x9c7d4fb43919def524c1a9d92fe836169eaf0615"
// const EXCLUDED_ADDRESSES: string[] = [
//   "0xae859c9a2de7fd2265293adeb45b01e8cf693a7b", // Marketing/Dev
// ]
// // Standard ERC20 interface we can always rely on
// interface IERC20 {
//   function balanceOf(address account) external view returns (uint256);
//   function transfer(address recipient, uint256 amount) external returns (bool);
//   event Transfer(address indexed from, address indexed to, uint256 value);
// }

// export function handleTransfer(event: Transfer): void {
//   let token = Token.load(event.address.toHexString())
//   if (!token) {
//     token = initializeToken(event.address)
//   }
  
//   let contract = TokenContract.bind(event.address)
//   let features = TokenAnalyzer.analyzeFeatures(event.address)
  
//   // Get real balances
//   let fromBalance = contract.balanceOf(event.params.from)
//   let toBalance = contract.balanceOf(event.params.to)
  
//   let fromAccount = loadOrCreateAccount(event.params.from, token)
//   let toAccount = loadOrCreateAccount(event.params.to, token)
  
//   // Update balances with actual values
//   fromAccount.balance = fromBalance
//   fromAccount.formattedBalance = TokenAnalyzer.calculateFormattedBalance(fromBalance)
  
//   toAccount.balance = toBalance
//   toAccount.formattedBalance = TokenAnalyzer.calculateFormattedBalance(toBalance)
  
//   // Create transaction record
//   let transaction = new Transaction(
//     event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
//   )
//   transaction.token = token.id
//   transaction.from = fromAccount.id
//   transaction.to = toAccount.id
//   transaction.value = event.params.value
//   transaction.transferType = TokenAnalyzer.getTransferType(
//     event.params.from,
//     event.params.to,
//     features
//   )
  
//   if (features.hasReflection) {
//     let currentRate = TokenAnalyzer.getCurrentRate(contract)
//     transaction.reflectionValue = event.params.value.times(currentRate)
    
//     // Create reflection rate record
//     let reflectionRate = new ReflectionRate(
//       event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
//     )
//     reflectionRate.token = token.id
//     reflectionRate.rate = currentRate
//     reflectionRate.block = event.block.number
//     reflectionRate.timestamp = event.block.timestamp
//     reflectionRate.save()
    
//     // Create balance snapshots
//     createBalanceSnapshot(fromAccount, fromBalance, currentRate, event.block.number, event.block.timestamp)
//     createBalanceSnapshot(toAccount, toBalance, currentRate, event.block.number, event.block.timestamp)
//   }
  
//   // Update timestamps and save
//   transaction.timestamp = event.block.timestamp
//   transaction.block = event.block.number
//   transaction.transactionHash = event.transaction.hash.toHexString()
  
//   // Save all entities
//   token.save()
//   fromAccount.save()
//   toAccount.save()
//   transaction.save()
// }



// function createBalanceSnapshot(
//   account: Account,
//   balance: BigInt,
//   rate: BigInt,
//   blockNumber: BigInt,
//   timestamp: BigInt
// ): void {
//   let snapshot = new BalanceSnapshot(
//     account.id + "-" + blockNumber.toString()
//   )
//   snapshot.account = account.id
//   snapshot.balance = balance
//   snapshot.rate = rate
//   snapshot.blockNumber = blockNumber
//   snapshot.timestamp = timestamp
//   snapshot.save()
// }

// function isExcluded(address: Address): boolean {
//   let addressStr = address.toHexString().toLowerCase()
//   return EXCLUDED_ADDRESSES.includes(addressStr)
// }

// function loadOrCreateAccount(address: Address, token: Token, contract: TokenContract): Account {
//   let account = Account.load(address.toHexString())
//   if (!account) {
//     account = new Account(address.toHexString())
//     account.token = token.id
//     account.balance = BigInt.fromI32(0)
//     account.rBalance = BigInt.fromI32(0)
//     account.isExcluded = false
//     account.isBlocked = false
//     account.lastUpdateBlock = BigInt.fromI32(0)
//     account.lastUpdateRate = BigInt.fromI32(0)
//     account.percentageOwned = BigDecimal.fromString("0")
//   }
//   return account
// }

// export function handleSetMaxWalletSize(call: SetMaxWalletSize): void {
//   let token = Token.load(call.to.toHexString())
//   if (token) {
//     token.maxWalletSize = call.inputs.maxWalletSize
//     token.save()
//   }
// }





// // Add block handler for periodic updates
