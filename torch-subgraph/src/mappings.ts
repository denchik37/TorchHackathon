import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  BetPlaced,
  BetFinalized,
  BetClaimed,
  BatchProcessed,
  FeeCollected,
  AggregationCompleted,
  BucketPriceSet,
  TorchPredictionMarket
} from "../generated/TorchPredictionMarket/TorchPredictionMarket"
import { User, UserStats, Bet, Fee, Bucket } from "../generated/schema"


/** -------- Helper: Create/Load User + Stats -------- */
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


/** -------- Event: BetPlaced -------- */
export function handleBetPlaced(event: BetPlaced): void {
  let stats = getOrCreateUser(event.params.bettor)

  let contract = TorchPredictionMarket.bind(event.address)
  let betResult = contract.try_getBet(event.params.betId)
  if (betResult.reverted) return
  let betData = betResult.value

  let betId = event.params.betId.toString()
  let bet = new Bet(betId)
  bet.user = event.params.bettor.toHexString()

  // ---- Bucket ----
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) {
    bucket = new Bucket(bucketId)
    bucket.totalBets = 0
    bucket.aggregationComplete = false
    bucket.totalWinningWeight = BigInt.zero()
    bucket.nextProcessIndex = 0
    bucket.price = null
  }
  bucket.totalBets += 1
  bucket.save()

  bet.bucket = event.params.bucket.toI32()
  bet.bucketRef = bucketId

  // ---- Bet Data ----
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

  // ---- Stats Update ----
  stats.totalBets += 1
  stats.totalStaked = stats.totalStaked.plus(bet.stake)
  stats.save()
}


/** -------- Event: BetFinalized -------- */
export function handleBetFinalized(event: BetFinalized): void {
  let bet = Bet.load(event.params.betId.toString())
  if (!bet) return

  bet.finalized = true
  bet.actualPrice = event.params.actualPrice
  bet.won = event.params.won
  bet.payout = event.params.payout
  bet.save()

  // Update stats if win
  if (event.params.won) {
    let stats = UserStats.load(bet.user)
    if (stats) {
      stats.totalWon += 1
      stats.totalPayout = stats.totalPayout.plus(event.params.payout)
      stats.save()
    }
  }
}


/** -------- Event: BetClaimed -------- */
export function handleBetClaimed(event: BetClaimed): void {
  let bet = Bet.load(event.params.betId.toString())
  if (!bet) return

  bet.claimed = true
  bet.save()

  let stats = UserStats.load(event.params.bettor.toHexString())
  if (stats) {
    stats.totalPayout = stats.totalPayout.plus(event.params.payout)
    stats.save()
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


/** -------- Event: AggregationCompleted -------- */
export function handleAggregationCompleted(event: AggregationCompleted): void {
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)

  if (!bucket) return

  bucket.aggregationComplete = true
  bucket.save()
}


/** -------- Event: BucketPriceSet  -------- */
export function handleBucketPriceSet(event: BucketPriceSet): void {
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)

  if (!bucket) {
    bucket = new Bucket(bucketId)
    bucket.totalBets = 0
    bucket.totalWinningWeight = BigInt.zero()
    bucket.nextProcessIndex = 0
    bucket.aggregationComplete = false
  }

  bucket.price = event.params.price
  bucket.save()
}

/** -------- Event: BatchProcessed -------- */
export function handleBatchProcessed(event: BatchProcessed): void {
  let bucketId = event.params.bucket.toString()
  let bucket = Bucket.load(bucketId)
  if (!bucket) return

  let contract = TorchPredictionMarket.bind(event.address)

  // Loop through the bets in the batch
  for (let i = 0; i < event.params.processedCount.toI32(); i++) {
    let betIndex = bucket.nextProcessIndex + i
    let betId = BigInt.fromI32(betIndex).toString()
    let bet = Bet.load(betId)
    if (!bet || bet.finalized) continue

    // Fetch bet details from the contract
    let betResult = contract.try_getBet(BigInt.fromString(bet.id))
    if (betResult.reverted) continue
    let betData = betResult.value

    // Update bet with on-chain data
    bet.finalized = betData.finalized
    bet.actualPrice = betData.actualPrice
    bet.won = betData.won

    // Use on-chain payout if available, otherwise zero
    bet.payout = betData.payout ? betData.payout : BigInt.zero()
    bet.save()

    // Update user stats if won
    if (bet.won) {
      let stats = UserStats.load(bet.user)
      if (stats) {
        stats.totalWon += 1
        stats.totalPayout = stats.totalPayout.plus(bet.payout)
        stats.save()
      }
    }
  }

  // Update bucket info AFTER processing all bets
  let winningWeight: BigInt
  if (event.params.winningWeight) {
    winningWeight = event.params.winningWeight as BigInt
  } else {
    winningWeight = BigInt.zero()
  }
  bucket.totalWinningWeight = bucket.totalWinningWeight.plus(winningWeight)

  bucket.nextProcessIndex += event.params.processedCount.toI32()
  if (bucket.nextProcessIndex >= bucket.totalBets) {
    bucket.aggregationComplete = true
  }
  bucket.save()
}

