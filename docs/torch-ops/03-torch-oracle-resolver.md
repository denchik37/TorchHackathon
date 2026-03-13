# Torch Oracle Resolver

## What it does

The resolver runs on a schedule (e.g. every 15 minutes) or on-demand. It:

1. Loads **unresolved** work from the subgraph (bets with `finalized: false` and bucket `aggregationComplete: false`).
2. Filters **eligible** target timestamps (timestamp ≤ now − buffer; optional backlog/backfill rules).
3. For each eligible timestamp: gets **CoinGecko** historical price; optionally **oracle** (Chainlink/Pyth) latest; if divergence &gt; threshold, **blocks** that timestamp (does not set price).
4. Calls **setPricesForTimestamps** in batches, then **processBatch** per bucket until each bucket is complete or the per-bucket tx limit is reached.
5. Persists **run artifact** (`runs/RESOLVE-*.json`) and updates **state.json** (resolved/blocked timestamps).

---

## Backlog draining algorithm (oldest-first)

- **Eligible timestamps**: From unresolved bets, unique `targetTimestamp` where:
  - `targetTimestamp <= nowUnix - FINALIZATION_BUFFER_SECONDS`
  - Optional: `BACKLOG_START_FROM` (ISO date) → only timestamps ≥ that date (staged backfill).
  - Optional: ignore timestamps older than `BACKLOG_MAX_AGE_DAYS` unless backfilling.
- **Sort**: Ascending (oldest first).
- **Cap**: Up to `MAX_TIMESTAMPS_PER_TX * K` timestamps per run (K = small multiplier to avoid huge runs).
- **Buckets**: After setting prices, **all** unresolved buckets (from subgraph) are processed, not only those that got new prices this run — so partial progress (e.g. bucket already had prices from a previous run) is continued.

---

## Eligibility rules (timestamp ≤ now − buffer)

- `eligible = targetTimestamp <= (nowUnix - FINALIZATION_BUFFER_SECONDS)`.
- Default buffer: `FINALIZATION_BUFFER_SECONDS=120` (2 minutes).
- Timestamps that are “too soon” are skipped and listed in the artifact as `skippedTooSoon`; they can be picked in a later run.

---

## Price sourcing: CoinGecko primary + oracle check (high-level)

- **Primary**: CoinGecko `market_chart/range` around target timestamp (±300s); pick closest point to target (or average within ±60s).
- **Oracle**: Chainlink or Pyth “latest” HBAR/USD (or historical if supported). Used only for **divergence check**.
- **Divergence**: `divergencePct = |coinGecko - oracle| / coinGecko * 100`. If `divergencePct > MAX_PRICE_DIVERGENCE_PCT` → timestamp is **blocked** (not submitted); reason stored in `state.json` and in run artifact `priceChecks[].status = "blocked"`.
- **Canonical**: When not blocked, **CoinGecko** value is used for `setPricesForTimestamps` (converted to 8-decimal contract format).

---

## Admin tx sequence

1. **setPricesForTimestamps(timestamps[], prices[])**  
   - Batches of `MAX_TIMESTAMPS_PER_TX` (default 50).  
   - Prices: USD → `parseUnits(price.toFixed(8), 8)`.  
   - Only for timestamps that passed the price check and are not already in `state.resolvedTimestamps`.

2. **processBatch(bucket)** per unresolved bucket  
   - Loop: call `processBatch(bucket)`; then read `getBucketInfo(bucket)` from contract.  
   - Stop when `aggregationComplete === true` or after `MAX_PROCESS_BATCH_TX_PER_BUCKET` txs (default 20).  
   - Next run will resume from updated `nextProcessIndex` for any bucket not yet complete.

---

## Idempotency and partial progress

- **state.json**: `resolvedTimestamps[ts] = setPricesTxId`; if a timestamp is already there, the resolver does **not** call setPrices for it again (but may still call processBatch for buckets containing that timestamp).
- **Buckets**: Processed every run until complete; if a run stops mid-bucket, the next run continues from the current `nextProcessIndex` (from contract/subgraph).
- **Blocked timestamps**: Stored in `state.blockedTimestamps[ts] = { reason, lastSeenAt }` so operators can see why a timestamp was skipped.

---

## Artifacts schema (resolver runs)

**Path**: `torch-oracle-resolver/runs/RESOLVE-YYYY-MM-DDTHH-mm-ssZ.json` (one file per run).

**Shape** (see `src/types.ts` and run artifact in code):

```json
{
  "runId": "2025-03-10T14-00-00",
  "timestampUtc": "2025-03-10T14:00:00.000Z",
  "mode": "live",
  "unresolvedCounts": { "bets": 10, "buckets": 2, "uniqueTimestamps": 5 },
  "eligibleTimestamps": [1741234500, 1741234600],
  "skippedTooSoon": [1741234700],
  "skippedTooOld": [],
  "priceChecks": [
    {
      "timestamp": 1741234500,
      "coinGeckoPrice": 0.0954,
      "oraclePrice": 0.0952,
      "divergencePct": 0.21,
      "status": "accepted"
    },
    {
      "timestamp": 1741234600,
      "coinGeckoPrice": 0.0960,
      "oraclePrice": 0.0930,
      "divergencePct": 3.13,
      "status": "blocked",
      "reason": "Divergence 3.13% > 1.0%"
    }
  ],
  "txs": {
    "setPricesBatchTxIds": ["0.0.123@..."],
    "processBatchTxIds": [
      { "bucketId": "1", "txIds": ["0.0.124@...", "0.0.125@..."] }
    ]
  },
  "bucketResults": [
    {
      "bucketId": "1",
      "processedTxCount": 2,
      "completed": true,
      "nextProcessIndex": 50,
      "totalBets": 50
    }
  ],
  "errors": []
}
```

**state.json** (same directory or project root):

```json
{
  "lastRunAt": "2025-03-10T14:00:00.000Z",
  "blockedTimestamps": {
    "1741234600": { "reason": "Divergence 3.13% > 1.0%", "lastSeenAt": "2025-03-10T14:00:00.000Z" }
  },
  "resolvedTimestamps": {
    "1741234500": "0.0.123@..."
  }
}
```

---

## Failure modes and “blocked timestamps” behavior

- **Blocked**: Timestamp not submitted to the contract; appears in `priceChecks` with `status: "blocked"` and in `state.blockedTimestamps`. Resolver does not retry automatically; operator can fix oracle/CoinGecko or adjust `MAX_PRICE_DIVERGENCE_PCT` / manual override later.
- **setPrices fails**: Run artifact records the error; `resolvedTimestamps` is not updated for that batch; next run can retry (idempotent).
- **processBatch fails mid-bucket**: Bucket stays incomplete; next run will call processBatch again for that bucket from current `nextProcessIndex`.
- **Subgraph lag**: Resolver may see stale “unresolved” data; once subgraph catches up, next run will process remaining work.
