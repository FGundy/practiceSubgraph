//src/tokenAnalyzer.ts
import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { LandWolf as TokenContract } from "../generated/LandWolf/LandWolf"
import { UniswapV2Pair } from "../generated/LandWolf/UniswapV2Pair"


export class TokenFeatures {
  hasReflection: boolean
  hasTax: boolean
  hasMaxTxAmount: boolean
  hasMaxWalletSize: boolean
  dexPairs: string[]
  
  constructor() {
    this.hasReflection = false
    this.hasTax = false
    this.hasMaxTxAmount = false
    this.hasMaxWalletSize = false
    this.dexPairs = []
  }
}

export class TokenAnalyzer {
    static readonly DEX_PAIRS: string[] = [
        "0x6a8fc7e8186ddc572e3fffe91146430c3542bfd1", // WOLF-ETH Uniswap V2
    ]

    static readonly ZERO_ADDRESS: string = "0x0000000000000000000000000000000000000000"

    
    static isKnownDexPair(address: string): boolean {
    return this.DEX_PAIRS.includes(address.toLowerCase())
    }
    static getDexPairPrice(pairAddress: Address): BigDecimal {
        let pair = UniswapV2Pair.bind(pairAddress)
        let reserves = pair.try_getReserves()
        if (!reserves.reverted) {
            // Calculate price
            return BigDecimal.fromString("0")
        }
        return BigDecimal.fromString("0")
    }
    
    static updateAccountBalances(contract: LandWolf, address: Address): TokenBalances {
        let balances = new TokenBalances()
        let balanceResult = contract.try_balanceOf(address)
        if (!balanceResult.reverted) {
            balances.balance = balanceResult.value
        }
        // Add other balance calculations
        return balances
    }

    static analyzeFeatures(address: Address): TokenFeatures {
        let contract = TokenContract.bind(address)
        let features = new TokenFeatures()
        
        // Detect reflection mechanism
        let rSupply = contract.try_getCurrentSupply()
        features.hasReflection = !rSupply.reverted
        
        // Detect tax mechanism
        let taxFee = contract.try_getTaxFee()
        features.hasTax = !taxFee.reverted
        
        // Detect transaction limits
        let maxTx = contract.try_maxTxAmount()
        features.hasMaxTxAmount = !maxTx.reverted
        
        // Detect wallet size limits
        let maxWallet = contract.try_maxWalletSize()
        features.hasMaxWalletSize = !maxWallet.reverted
        
        features.dexPairs = this.DEX_PAIRS
        
        return features
    }

    static getTransferType(
        from: Address,
        to: Address,
        features: TokenFeatures
    ): string {
        let fromAddress = from.toHexString().toLowerCase()
        let toAddress = to.toHexString().toLowerCase()
        
        // Check for initial distribution
        if (fromAddress == "0x0000000000000000000000000000000000000000") {
        return "INITIAL_DISTRIBUTION"
        }
        
        // Check for DEX interactions
        for (let i = 0; i < features.dexPairs.length; i++) {
        if (fromAddress == features.dexPairs[i]) {
            return "BUY"
        }
        if (toAddress == features.dexPairs[i]) {
            return "SELL"
        }
        }
        
        return "TRANSFER"
    }

    static calculateFormattedBalance(balance: BigInt): BigDecimal {
        return balance.toBigDecimal()
        .div(BigDecimal.fromString("1000000000000000000"))
    }

    static getCurrentRate(contract: TokenContract): BigInt {
        let rSupply = contract.try_getCurrentSupply()
        if (!rSupply.reverted) {
        return rSupply.value.value0.div(rSupply.value.value1)
        }
        return BigInt.fromI32(0)
    }
}



export class TokenBalances {
    balance: BigInt
    rBalance: BigInt
    formattedBalance: BigDecimal
  
    constructor() {
      this.balance = BigInt.fromI32(0)
      this.rBalance = BigInt.fromI32(0)
      this.formattedBalance = BigDecimal.fromString("0")
    }
  }
  

  export class TokenStandard {
    static isCompliant(contract: TokenContract): boolean {
        // Check required ERC20 methods
        let totalSupply = contract.try_totalSupply()
        let balanceOf = contract.try_balanceOf(Address.fromString(ZERO_ADDRESS))
        let transfer = contract.try_transfer(Address.fromString(ZERO_ADDRESS), BigInt.fromI32(0))
        
        return !totalSupply.reverted && !balanceOf.reverted && !transfer.reverted
    }
    
    static getExtensions(contract: TokenContract): string[] {
        let extensions: string[] = []
        
        // Check for reflection extension
        if (!contract.try_getCurrentSupply().reverted) {
            extensions.push("REFLECTION")
        }
        
        // Check for fee-on-transfer
        if (!contract.try_getTaxFee().reverted) {
            extensions.push("FEE_ON_TRANSFER")
        }
        
        return extensions
    }
  }
  
  
  
  