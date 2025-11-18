import { BigInt, Address } from "@graphprotocol/graph-ts"
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

  // Create immutable User if not exists
  let user = User.load(userId)
  if (!user) {
    user = new User(userId)
    user.save()
  }

  // Create mutable UserStats if not exists
  let stats = UserStats.load(userId)
  if (!stats) {
    stats = new UserStats(userId)
    stats.totalBets = 0
    stats.totalWon = 0
    stats.totalStaked = BigInt.zero()
    stats.totalPayout = BigInt.zero()
    stats.save()
  }

  return stats
}

/* ---------------- BET PLACED ---------------- */
export function handleBetPlaced(event: BetPlaced): void {
  let stats = getOrCreateUser(event.params.bettor)

  let contract = TorchPredictionMarket.bind(event.address)
  let result = contract.try_getBet(event.params.betId)
  if (result.reverted) return
  let betData = result.value

  let betId = event.params.betId.toString()
  let bet = new Bet(betId)

  bet.user = event.params.bettor.toHexString()

  /* ---- Bucket creation and reference ---- */
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = new Bucket(bucketId)
    bucket.totalBets = 0
    bucket.aggregationComplete = false
  }
  bucket.totalBets += 1
  bucket.save()

  bet.bucket = event.params.bucket.toI32()
  bet.bucketRef = bucketId // reference to Bucket entity

  /* ---- Store contract data ---- */
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
  bet.payout = BigInt.zero()

  bet.blockNumber = event.block.number
  bet.timestamp = event.block.timestamp
  bet.transactionHash = event.transaction.hash

  bet.save()

  /* ---- Update user stats ---- */
  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()
}

/* ---------------- BET FINALIZED ---------------- */
export function handleBetFinalized(event: BetFinalized): void {
  let bet = Bet.load(event.params.betId.toString())
  if (!bet) return

  bet.finalized = true
  bet.actualPrice = event.params.actualPrice
  bet.won = event.params.won
  bet.payout = event.params.payout
  bet.save()

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
  if (!bet) return

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
    bucket = new Bucket(bucketId)
    bucket.totalBets = 0
    bucket.aggregationComplete = false
  }

  bucket.aggregationComplete = true
  bucket.save()
}
