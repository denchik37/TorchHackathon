# Copy-paste summaries for ChatGPT (Option A)

Use the sections below by copying into ChatGPT to generate the final Option A deployment prompt and step-by-step instructions.

---

## A) Betting Bot Summary (paste into ChatGPT)

**Torch Agent Kit Bot — summary for Option A docs**

- **What it is**: Node.js (ESM) daily job that places one bet per eligible 12:00 UTC target on Hedera (TorchPredictionMarket). Uses OpenAI for Min/Max price range; parses one line; encodes 8dp price and tinybar stake; calls contract placeBet; writes one artifact per calendar day.
- **Env vars (names only)**: ACCOUNT_ID, PRIVATE_KEY, NETWORK, TORCH_CONTRACT_ID, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_REASONING_EFFORT, OPENAI_MAX_COMPLETION_TOKENS, CONFIDENCE_PERCENT, SYMBOL, STAKE_HBAR, MAX_DAILY_SPEND_HBAR, MIN_TARGET_LEAD_SECONDS, DAYS_AHEAD, DRY_RUN, LOG_LEVEL, GAS_LIMIT.
- **Run artifact**: Path `runs/YYYY-MM-DD.json`. Fields: runId, timestampUtc, provider (model, reasoning_effort, max_completion_tokens), forecasts (betKey, targetTimestamp, monthDay, prompt, raw, minStr, maxStr), betParams (betKey, priceMinStr, priceMaxStr, priceMinInt, priceMaxInt, stakeHbar), results (betKey, targetTimestamp, txId?, status?, dryRun?, skippedDuplicate?, error?).
- **Idempotency**: betKey = `${SYMBOL}:${targetTimestamp}`. Within same day artifact, skip placeBet if result already has txId and status 22.
- **Schedule**: Invoke `npm run daily` once per day (e.g. systemd timer 08:00 UTC). No built-in cron.

---

## B) Resolver Summary (paste into ChatGPT)

**Torch Oracle Resolver — summary for Option A docs**

- **What it is**: Node.js (ESM) worker that drains backlog of unresolved bets: loads from subgraph, filters eligible timestamps (≤ now − buffer), gets CoinGecko historical price per timestamp, optional oracle cross-check; if divergence &gt; threshold blocks timestamp; else submits setPricesForTimestamps (batched) then processBatch per bucket until complete or per-bucket limit.
- **Env vars (names only)**: NETWORK, ADMIN_ACCOUNT_ID, ADMIN_PRIVATE_KEY, TORCH_CONTRACT_ID, SUBGRAPH_URL, COINGECKO_API_KEY, PRICE_SOURCE_MODE, ORACLE_PROVIDER, MAX_PRICE_DIVERGENCE_PCT, FINALIZATION_BUFFER_SECONDS, MAX_TIMESTAMPS_PER_TX, MAX_BUCKETS_PER_RUN, MAX_PROCESS_BATCH_TX_PER_BUCKET, DRY_RUN, BACKLOG_START_FROM, BACKLOG_MAX_AGE_DAYS, RESOLVE_CONCURRENCY, RESOLVER_TRIGGER_SECRET.
- **Run artifact**: Path `runs/RESOLVE-YYYY-MM-DDTHH-mm-ssZ.json`. Fields: runId, timestampUtc, mode (dryRun|live), unresolvedCounts (bets, buckets, uniqueTimestamps), eligibleTimestamps, skippedTooSoon, skippedTooOld, priceChecks (timestamp, coinGeckoPrice, oraclePrice, divergencePct, status accepted|blocked, reason?), txs (setPricesBatchTxIds, processBatchTxIds [{ bucketId, txIds }]), bucketResults (bucketId, processedTxCount, completed, nextProcessIndex?, totalBets?), errors.
- **State file**: `state.json`: lastRunAt, blockedTimestamps { [ts]: { reason, lastSeenAt } }, resolvedTimestamps { [ts]: setPricesTxId }.
- **Admin tx methods called**: setPricesForTimestamps(uint256[] timestamps, uint256[] prices) in batches; processBatch(uint256 bucket) per bucket until aggregationComplete or MAX_PROCESS_BATCH_TX_PER_BUCKET.
- **Backlog behavior**: Oldest eligible timestamps first; process all unresolved buckets every run (not only those with new prices); partial progress persisted so next run continues from nextProcessIndex.

---

## C) Dashboard Summary (paste into ChatGPT)

**Betting Dashboard (Agent Kit) — summary for Option A docs**

- **What it is**: Read-only Next.js dashboard showing bot runs and (Option A) resolver runs. Runs on Vercel; in Option A it fetches from a Hetzner read-only API with Bearer token.
- **Pages**: / (Overview: last run, next target, KPIs, charts, account card); /runs (table of run summaries with filters); /runs/[date] (full run artifact); /account (bot account + balance + Mirror txs).
- **Required endpoints (Option A)**: GET /api/betting/runs → list of { date, runId, timestampUtc, forecastCount, betParamCount, resultCount, successCount, dryRunCount, skippedCount, failedCount }; GET /api/betting/runs/:date → full run artifact (same shape as bot runs/YYYY-MM-DD.json); GET /api/resolver/runs → { runs: [{ runId, name }] }; GET /api/resolver/runs/:id → full resolver run artifact; GET /api/health → { lastRun?, nextTargetTimestamp, nextTargetDate, lastResolverRun? }; optional GET /api/account → { accountId, network, balance, transactions }.
- **Expected JSON contracts**: Betting run artifact: runId, timestampUtc, provider, forecasts[], betParams[], results[]. Resolver run artifact: runId, timestampUtc, mode, unresolvedCounts, eligibleTimestamps, skippedTooSoon, skippedTooOld, priceChecks[], txs, bucketResults[], errors[]. All endpoints require Authorization: Bearer &lt;token&gt;.

---

## D) Option A requirements checklist (paste into ChatGPT)

**Option A deployment — requirements checklist**

- **Hetzner**: One (or more) boxes; bot and resolver run as systemd oneshot + timer; read-only API runs as long-lived process (Node or Next.js server). Env files for bot, resolver, and API (DASHBOARD_API_TOKEN, BETTING_RUNS_DIR, RESOLVER_RUNS_DIR, PORT). No secrets in API responses.
- **Ports**: nginx 443 (HTTPS), 80 → 443; API app listens on internal port (e.g. 3000); nginx proxies to it.
- **Endpoints**: /api/betting/runs, /api/betting/runs/:date, /api/resolver/runs, /api/resolver/runs/:id, /api/health; optional /api/account. All GET; all require Authorization: Bearer &lt;DASHBOARD_API_TOKEN&gt;.
- **Security**: Bearer token required; rate limiting at nginx (e.g. 60/min per IP or token); HTTPS only; no PRIVATE_KEY, OPENAI_API_KEY, or ADMIN_PRIVATE_KEY in any API response.
- **Vercel**: Env vars NEXT_PUBLIC_BETTING_API_BASE (or NEXT_PUBLIC_API_BASE), DASHBOARD_API_TOKEN (prefer server-side only). Dashboard fetches from API; validate that Overview and Runs show data and 401 without token.
- **Caching**: API can send Cache-Control for short TTL; dashboard can use 10–60s revalidate or SWR/React Query so UI is fresh without overloading API.
