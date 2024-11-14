import { BigDecimal } from "@graphprotocol/graph-ts"

export class BalanceVerifier {
  static KNOWN_HOLDERS: Map<string, string> = new Map()
  
  static initialize(): void {
    // Top 10 holders from Etherscan
    this.KNOWN_HOLDERS.set(
      "0x25752db4c905B2059",
      "27767849.7453002779880789"
    )
    this.KNOWN_HOLDERS.set(
      "0xEeAE3459Eb5876F9B",
      "4204172.0396707358616450"
    )
    // Add other known holders...
  }
  
  static verifyBalance(address: string, balance: BigDecimal): boolean {
    let knownBalance = this.KNOWN_HOLDERS.get(address)
    if (!knownBalance) return true
    
    // Compare with 0.0001% tolerance
    let diff = balance.minus(BigDecimal.fromString(knownBalance)).abs()
    let tolerance = BigDecimal.fromString("0.00001")
    
    return diff.le(tolerance)
  }
}