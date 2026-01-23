import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  BetPlaced,
  BetClaimed,
  FeeCollected,
  AggregationCompleted,
  BucketPriceSet,
  BatchProcessed,
  TorchPredictionMarket
} from "../generated/TorchPredictionMarket/TorchPredictionMarket"

import { User, UserStats, Bet, Fee, Bucket, PriceAtTimestamp } from "../generated/schema"

/** -------- Helpers: User + Stats -------- */
function getOrCreateUser(address: Address): UserStats {
  let id = address.toHexString()

  let user = User.load(id)
  if (!user) {
    user = new User(id)
    user.save()
  }

  let stats = UserStats.load(id)
  if (!stats) {
    stats = new UserStats(id)
    stats.totalBets = 0
    stats.totalWon = 0
    stats.totalStaked = BigInt.zero()
    stats.totalPayout = BigInt.zero()
    stats.save()
  }

  return stats
}

function incrementUserWon(userId: string): void {
  let stats = UserStats.load(userId)
  if (!stats) return
  stats.totalWon += 1
  stats.save()
}

function addUserPayout(userId: string, payout: BigInt): void {
  let stats = UserStats.load(userId)
  if (!stats) return
  stats.totalPayout = stats.totalPayout.plus(payout)
  stats.save()
}

/** -------- Helpers: Bucket -------- */
function getOrCreateBucket(bucketId: string): Bucket {
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = new Bucket(bucketId)
    bucket.totalBets = 0
    bucket.aggregationComplete = false
    bucket.totalWinningWeight = BigInt.zero()
    bucket.nextProcessIndex = 0
    bucket.betIds = []
    bucket.save()
  }
  return bucket as Bucket
}

/** -------- Event: BetPlaced -------- */
export function handleBetPlaced(event: BetPlaced): void {
  let stats = getOrCreateUser(event.params.bettor)

  let contract = TorchPredictionMarket.bind(event.address)
  let betResult = contract.try_getBet(event.params.betId)
  if (betResult.reverted) return
  let betData = betResult.value

  let betId = event.params.betId.toString()

  // ---- Bucket ----
  let bucketId = event.params.bucket.toString()
  let bucket = getOrCreateBucket(bucketId)
  
  let ids = bucket.betIds
  bucket.betIds = ids.concat([betId])
  bucket.totalBets += 1
  bucket.save()

  // ---- Bet ----
  let bet = new Bet(betId)
  bet.user = event.params.bettor.toHexString()
  bet.bucket = event.params.bucket.toI32()
  bet.bucketRef = bucketId

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

  bet.wonCounted = false

  bet.blockNumber = event.block.number
  bet.timestamp = event.block.timestamp
  bet.transactionHash = event.transaction.hash

  bet.save()

  // ---- Stats ----
  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()
}

/** -------- Event: BatchProcessed -------- */
export function handleBatchProcessed(event: BatchProcessed): void {
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) return

  let contract = TorchPredictionMarket.bind(event.address)

  let oldStart = bucket.nextProcessIndex

  let info = contract.try_getBucketInfo(event.params.bucket)
  if (info.reverted) return

  let totalBets = info.value.value0.toI32()
  let totalWinningWeight = info.value.value1
  let newNext = info.value.value2.toI32()
  let aggregationComplete = info.value.value3

  for (let i = oldStart; i < newNext; i++) {
    if (i >= bucket.betIds.length) break

    let betId = bucket.betIds[i]
    let bet = Bet.load(betId)
    if (!bet) continue

    let betResult = contract.try_getBet(BigInt.fromString(betId))
    if (betResult.reverted) continue
    let betData = betResult.value

    bet.finalized = betData.finalized
    bet.actualPrice = betData.actualPrice
    bet.won = betData.won

    if (betData.won && !bet.wonCounted) {
      bet.wonCounted = true
      incrementUserWon(bet.user)
    }

    bet.save()
  }

  bucket.totalBets = totalBets
  bucket.totalWinningWeight = totalWinningWeight
  bucket.nextProcessIndex = newNext
  bucket.aggregationComplete = aggregationComplete
  bucket.save()
}

/** -------- Event: AggregationCompleted -------- */
export function handleAggregationCompleted(event: AggregationCompleted): void {
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = getOrCreateBucket(bucketId)
  }

  bucket.aggregationComplete = true
  bucket.totalWinningWeight = event.params.totalWinningWeight
  bucket.save()
}

/** -------- Event: BetClaimed ------- */
export function handleBetClaimed(event: BetClaimed): void {
  let betId = event.params.betId.toString()
  let bet = Bet.load(betId)
  if (!bet) return

  bet.claimed = true
  bet.payout = event.params.payout
  bet.save()

  if (bet.won && !bet.wonCounted) {
    bet.wonCounted = true
    bet.save()
    incrementUserWon(bet.user)
  }

  if (event.params.payout.gt(BigInt.zero())) {
    addUserPayout(event.params.bettor.toHexString(), event.params.payout)
  }
}

/** -------- Event: FeeCollected -------- */
export function handleFeeCollected(event: FeeCollected): void {
  let id = `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
  let fee = new Fee(id)

  fee.amount = event.params.amount
  fee.blockNumber = event.block.number
  fee.timestamp = event.block.timestamp
  fee.transactionHash = event.transaction.hash

  fee.save()
}

/** -------- Event: BucketPriceSet ------- */
export function handleBucketPriceSet(event: BucketPriceSet): void {
  let ts = event.params.bucket
  let id = ts.toString()

  let p = PriceAtTimestamp.load(id)
  if (!p) {
    p = new PriceAtTimestamp(id)
    p.timestamp = ts
  }

  p.price = event.params.price
  p.blockNumber = event.block.number
  p.blockTimestamp = event.block.timestamp
  p.transactionHash = event.transaction.hash
  p.save()
}
