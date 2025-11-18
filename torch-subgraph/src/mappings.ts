import { BigInt, Address, log } from "@graphprotocol/graph-ts"
import {
  BetPlaced,
  BetFinalized,
  BetClaimed,
  FeeCollected,
  AggregationCompleted,
  TorchPredictionMarket
} from "../generated/TorchPredictionMarket/TorchPredictionMarket"
import { User, UserStats, Bet, Fee, Bucket } from "../generated/schema"

// Helper to load or create immutable User + mutable UserStats
function getOrCreateUser(address: Address): UserStats {
  let userId = address.toHexString()

  // Immutable user
  let user = User.load(userId)
  if (!user) {
    log.info("[User] Creating new User entity: {}", [userId])
    user = new User(userId)
    user.save()
  }

  // Mutable stats
  let stats = UserStats.load(userId)
  if (!stats) {
    log.info("[UserStats] Creating new UserStats for: {}", [userId])
    stats = new UserStats(userId)
    stats.totalBets = 0
    stats.totalWon = 0
    stats.totalStaked = BigInt.zero()
    stats.totalPayout = BigInt.zero()
    stats.save() // ensure stats are persisted immediately
  }

  return stats
}

/* ---------------- BET PLACED ---------------- */
export function handleBetPlaced(event: BetPlaced): void {
  log.info("[BetPlaced] Handling bet {} from user {}", [
    event.params.betId.toString(),
    event.params.bettor.toHexString()
  ])

  let stats = getOrCreateUser(event.params.bettor)

  // Bind contract to call getBet()
  let contract = TorchPredictionMarket.bind(event.address)
  let result = contract.try_getBet(event.params.betId)
  if (result.reverted) {
    log.warning("[BetPlaced] Contract call getBet({}) reverted", [event.params.betId.toString()])
    return
  }
  let betData = result.value

  let betId = event.params.betId.toString()
  let bet = new Bet(betId)

  bet.user = event.params.bettor.toHexString()
  bet.bucket = event.params.bucket.toI32()
  bet.bucketRef = event.params.bucket.toString() // link bet to bucket

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
  bet.payout = BigInt.zero() // payout is updated later

  bet.blockNumber = event.block.number
  bet.timestamp = event.block.timestamp
  bet.transactionHash = event.transaction.hash

  bet.save()
  log.info("[BetPlaced] Saved Bet entity {} for user {}", [
    betId,
    event.params.bettor.toHexString()
  ])

  // Bucket logic
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    log.info("[Bucket] Creating new Bucket {}", [bucketId])
    bucket = new Bucket(bucketId)
    bucket.aggregationComplete = false
    bucket.totalBets = 0
  }
  bucket.totalBets += 1
  bucket.save()
  log.info("[Bucket] Updated Bucket {} | totalBets={}", [
    bucketId,
    bucket.totalBets.toString()
  ])

  // Update user stats
  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()
  log.info("[UserStats] Updated stats for {} | totalBets={} totalStaked={}", [
    event.params.bettor.toHexString(),
    stats.totalBets.toString(),
    stats.totalStaked.toString()
  ])
}

/* ---------------- BET FINALIZED ---------------- */
export function handleBetFinalized(event: BetFinalized): void {
  let bet = Bet.load(event.params.betId.toString())
  if (!bet) {
    log.warning("[BetFinalized] Bet {} not found", [event.params.betId.toString()])
    return
  }

  bet.finalized = true
  bet.actualPrice = event.params.actualPrice
  bet.won = event.params.won
  bet.payout = event.params.payout
  bet.save()
  log.info("[BetFinalized] Updated Bet {} as finalized", [bet.id])

  if (event.params.won) {
    let stats = UserStats.load(bet.user)
    if (stats) {
      stats.totalWon += 1
      stats.totalPayout = stats.totalPayout.plus(event.params.payout)
      stats.save()
    }
  }
}

/* ---------------- BET CLAIMED ---------------- */
export function handleBetClaimed(event: BetClaimed): void {
  let bet = Bet.load(event.params.betId.toString())
  if (!bet) {
    log.warning("[BetClaimed] Bet {} not found", [event.params.betId.toString()])
    return
  }

  bet.claimed = true
  bet.payout = event.params.payout
  bet.save()

  let stats = UserStats.load(event.params.bettor.toHexString())
  if (stats) {
    stats.totalPayout = stats.totalPayout.plus(event.params.payout)
    stats.save()
  }
}

/* ---------------- FEE COLLECTED ---------------- */
export function handleFeeCollected(event: FeeCollected): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let fee = new Fee(id)
  fee.amount = event.params.amount
  fee.blockNumber = event.block.number
  fee.timestamp = event.block.timestamp
  fee.transactionHash = event.transaction.hash
  fee.save()
}

/* ---------------- BUCKET AGGREGATION COMPLETED ---------------- */
export function handleAggregationCompleted(event: AggregationCompleted): void {
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    log.info("[Bucket] Creating late Bucket {}", [bucketId])
    bucket = new Bucket(bucketId)
    bucket.totalBets = 0
  }

  bucket.aggregationComplete = true
  bucket.save()
  log.info("[Bucket] Aggregation completed for Bucket {}", [bucketId])
}
