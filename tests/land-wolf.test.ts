import { assert, describe, test, clearStore } from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { handleTransfer } from "../src/mapping"
import { createTransferEvent } from "./land-wolf-utils"

describe("LandWolf Token", () => {
  test("Track Initial Distribution", () => {
    clearStore()
    
    let from = Address.fromString("0x0000000000000000000000000000000000000000")
    let to = Address.fromString("0x25752db4c905B2059")
    let amount = BigInt.fromString("27767849745300277988078899")
    
    let transferEvent = createTransferEvent(from, to, amount)
    handleTransfer(transferEvent)
    
    assert.fieldEquals(
      "Account",
      to.toHexString(),
      "formattedBalance",
      "27767849.7453002779880789"
    )
    assert.fieldEquals(
      "Transaction",
      transferEvent.transaction.hash.toHexString() + "-0",
      "transferType",
      "INITIAL_DISTRIBUTION"
    )
  })

  test("Track Buy Transaction", () => {
    clearStore()
    
    let from = Address.fromString("0x6a8fc7e8186ddc572e3fffe91146430c3542bfd1") // DEX pair
    let to = Address.fromString("0x1234567890123456789012345678901234567890")
    let amount = BigInt.fromString("1000000000000000000")
    
    let transferEvent = createTransferEvent(from, to, amount)
    handleTransfer(transferEvent)
    
    assert.fieldEquals(
      "Transaction",
      transferEvent.transaction.hash.toHexString() + "-0",
      "transferType",
      "BUY"
    )
  })
})

// Add more test cases for:
// - Reflection calculations
// - Fee handling
// - Balance updates
// - Excluded accounts
// - Blocked accounts