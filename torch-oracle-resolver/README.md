# Torch Oracle Resolver

Backlog-capable auto resolver for the Torch Prediction Market. Resolves unsettled bets by:

1. **Price source (hybrid)**  
   - Primary: CoinGecko historical “price at timestamp”.  
   - Secondary: On-chain oracle (Chainlink or Pyth) cross-check.  
   - If oracle deviates more than `MAX_PRICE_DIVERGENCE_PCT`, the timestamp is **blocked** (not finalized).

2. **On-chain steps**  
   - `setPricesForTimestamps(timestamps[], prices[])` in batches of `MAX_TIMESTAMPS_PER_TX`.  
   - For each affected bucket, `processBatch(bucket)` until the bucket is aggregation-complete or `MAX_PROCESS_BATCH_TX_PER_BUCKET` is reached.

3. **Idempotency**
   - State is stored in `RESOLVER_STATE_PATH` (or local `./state.json`): resolved timestamps + blocked timestamps.
   - Run artifacts are written to `RESOLVER_RUNS_DIR/RESOLVE-*.json` (or local `./runs/RESOLVE-*.json`).

## Requirements

- Node.js >= 20
- ESM + TypeScript strict

## Setup

```bash
cp .env.example .env
# Edit .env: ADMIN_ACCOUNT_ID, ADMIN_PRIVATE_KEY, TORCH_CONTRACT_ID, SUBGRAPH_URL, etc.
npm install
```

## Env (.env.example)

| Variable | Description |
|----------|-------------|
| `NETWORK` | `testnet` or `mainnet` |
| `ADMIN_ACCOUNT_ID` | Hedera account (contract owner) |
| `ADMIN_PRIVATE_KEY` | DER hex or raw key |
| `TORCH_CONTRACT_ID` | TorchPredictionMarket contract |
| `SUBGRAPH_URL` | Subgraph GraphQL endpoint |
| `COINGECKO_API_KEY` | Optional (Pro) |
| `PRICE_SOURCE_MODE` | `hybrid` |
| `ORACLE_PROVIDER` | `chainlink` or `pyth` |
| `MAX_PRICE_DIVERGENCE_PCT` | Skip if oracle differs more than this % |
| `FINALIZATION_BUFFER_SECONDS` | Only resolve timestamps with `targetTimestamp <= now - buffer` |
| `MAX_TIMESTAMPS_PER_TX` | Batch size for setPricesForTimestamps |
| `MAX_BUCKETS_PER_RUN` | Max buckets to process per run |
| `MAX_PROCESS_BATCH_TX_PER_BUCKET` | Max processBatch calls per bucket per run |
| `DRY_RUN` | `true` = no txs, only logs and artifacts |
| `BACKLOG_START_FROM` | `auto` or ISO date for staged backfill |
| `BACKLOG_MAX_AGE_DAYS` | Ignore timestamps older than this unless backfilling |
| `RESOLVER_TRIGGER_SECRET` | Optional secret for “trigger resolve” API |

## Scripts

- **`npm run resolve:once`** – Single run: load unresolved work, price check, setPrices + processBatch (or dry-run).
- **`npm run resolve:loop`** – Run once, then every N minutes (default 15). Set `RESOLVE_LOOP_INTERVAL_MS` to override.
- **`npm run test`** – Vitest.

## Run artifact (`RESOLVER_RUNS_DIR/RESOLVE-*.json`)

- `runId`, `timestampUtc`, `mode` (dryRun | live)
- `unresolvedCounts`, `eligibleTimestamps`, `skippedTooSoon`, `skippedTooOld`
- `priceChecks[]`: timestamp, coinGeckoPrice, oraclePrice, divergencePct, status (accepted | blocked)
- `txs`: setPricesBatchTxIds, processBatchTxIds per bucket
- `bucketResults[]`: bucketId, processedTxCount, completed, nextProcessIndex, totalBets
- `errors[]`

## State (`RESOLVER_STATE_PATH`)

- `lastRunAt`
- `blockedTimestamps`: { [ts]: { reason, lastSeenAt } }
- `resolvedTimestamps`: { [ts]: setPricesTxId }

Used to avoid re-setting prices and to resume after partial runs.

## Hetzner (systemd)

1. Copy `deploy/torch-oracle-resolver.service` and `deploy/torch-oracle-resolver.timer` for a systemd service and timer (e.g. run every 15 minutes). The dashboard can call an internal “trigger resolve” endpoint protected by `RESOLVER_TRIGGER_SECRET`; do not expose that endpoint publicly.
