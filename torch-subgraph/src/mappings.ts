import { BigInt, Address, log } from "@graphprotocol/graph-ts"
import {
  BetPlaced,
  BetFinalized,
  BetClaimed,
  FeeCollected,
  TorchPredictionMarket
} from "../generated/TorchPredictionMarket/TorchPredictionMarket"
import { User, UserStats, Bet, Fee } from "../generated/schema"

// Helper to load or create immutable User + mutable UserStats
function getOrCreateUser(address: Address): UserStats {
  let userId = address.toHexString()

  // Immutable user
  let user = User.load(userId)
  if (user == null) {
    log.info("[User] Creating new User entity: {}", [userId])
    user = new User(userId)
    user.save()
  } else {
    log.info("[User] Found existing User entity: {}", [userId])
  }

  // Mutable stats
  let stats = UserStats.load(userId)
  if (stats == null) {
    log.info("[UserStats] Creating new UserStats for: {}", [userId])
    stats = new UserStats(userId)
    stats.totalBets = 0
    stats.totalWon = 0
    stats.totalStaked = BigInt.zero()
    stats.totalPayout = BigInt.zero()
  } else {
    log.info("[UserStats] Loaded existing UserStats for: {}", [userId])
  }

  return stats
}

// BetPlaced
export function handleBetPlaced(event: BetPlaced): void {
  log.info("[BetPlaced] Handling bet from user {} with betId {}", [
    event.params.bettor.toHexString(),
    event.params.betId.toString()
  ])

  let stats = getOrCreateUser(event.params.bettor)

  // Bind contract to call getBet()
  let contract = TorchPredictionMarket.bind(event.address)
  let betDataResult = contract.try_getBet(event.params.betId)
  if (betDataResult.reverted) {
    log.warning("[BetPlaced] Contract call getBet({}) reverted", [event.params.betId.toString()])
    return
  }
  let betData = betDataResult.value

  let betId = event.params.betId.toString()
  let bet = new Bet(betId)

  bet.user = event.params.bettor.toHexString()
  bet.bucket = event.params.bucket.toI32()
  bet.stake = betData.stake
  bet.priceMin = betData.priceMin
  bet.priceMax = betData.priceMax
  bet.targetTimestamp = betData.targetTimestamp
  bet.qualityBps = betData.qualityBps
  bet.weight = betData.weight
  bet.finalized = betData.finalized
  bet.claimed = betData.claimed
  bet.actualPrice = betData.actualPrice
  bet.won = betData.won
  bet.payout = BigInt.zero()  // payout is likely zero until finalized/claimed

  bet.blockNumber = event.block.number
  bet.timestamp = event.block.timestamp
  bet.transactionHash = event.transaction.hash

  bet.save()

  log.info("[BetPlaced] Saved Bet entity {} for user {}", [
    betId,
    event.params.bettor.toHexString()
  ])

  // Update stats
  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()

  log.info("[BetPlaced] Updated UserStats for {} | totalBets={} totalStaked={}", [
    event.params.bettor.toHexString(),
    stats.totalBets.toString(),
    stats.totalStaked.toString()
  ])
}

// BetFinalized (no changes needed)
export function handleBetFinalized(event: BetFinalized): void {
  log.info("[BetFinalized] betId={} actualPrice={} won={} payout={}", [
    event.params.betId.toString(),
    event.params.actualPrice.toString(),
    event.params.won ? "true" : "false",
    event.params.payout.toString()
  ])

  let betId = event.params.betId.toString()
  let bet = Bet.load(betId)
  if (bet == null) {
    log.warning("[BetFinalized] Bet {} not found", [betId])
    return
  }

  bet.finalized = true
  bet.actualPrice = event.params.actualPrice
  bet.won = event.params.won
  bet.payout = event.params.payout
  bet.save()

  log.info("[BetFinalized] Updated Bet {} as finalized", [betId])

  if (event.params.won) {
    let stats = UserStats.load(bet.user)
    if (stats) {
      stats.totalWon += 1
      stats.totalPayout = stats.totalPayout.plus(event.params.payout)
      stats.save()

      log.info("[BetFinalized] User {} won | totalWon={} totalPayout={}", [
        bet.user,
        stats.totalWon.toString(),
        stats.totalPayout.toString()
      ])
    } else {
      log.warning("[BetFinalized] No UserStats found for winner {}", [bet.user])
    }
  }
}

// BetClaimed
export function handleBetClaimed(event: BetClaimed): void {
  log.info("[BetClaimed] betId={} claimed by {}", [
    event.params.betId.toString(),
    event.params.bettor.toHexString()
  ])

  let betId = event.params.betId.toString()
  let bet = Bet.load(betId)
  if (bet == null) {
    log.warning("[BetClaimed] Bet {} not found", [betId])
    return
  }

  bet.claimed = true
  bet.payout = event.params.payout
  bet.save()

  // Update user stats payout
  let stats = UserStats.load(event.params.bettor.toHexString())
  if (stats == null) {
    log.warning("[BetClaimed] No UserStats found for user {}", [event.params.bettor.toHexString()])
    return
  }
  stats.totalPayout = stats.totalPayout.plus(event.params.payout)
  stats.save()

  log.info("[BetClaimed] Bet {} marked as claimed, updated payout for user {}", [
    betId,
    event.params.bettor.toHexString()
  ])
}

// FeeCollected
export function handleFeeCollected(event: FeeCollected): void {
  let feeId = event.transaction.hash
    .toHex()
    .concat("-")
    .concat(event.logIndex.toString())

  log.info("[FeeCollected] id={} amount={}", [
    feeId,
    event.params.amount.toString()
  ])

  let fee = new Fee(feeId)
  fee.amount = event.params.amount
  fee.blockNumber = event.block.number
  fee.timestamp = event.block.timestamp
  fee.transactionHash = event.transaction.hash
  fee.save()

  log.info("[FeeCollected] Saved Fee entity {}", [feeId])
}
