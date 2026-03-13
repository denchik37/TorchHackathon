# Betting Dashboard (Agent Kit)

## Where it runs

- **Today**: Next.js app under `torch-agent-kit-bot/dashboard`; can run locally or on the same Hetzner box as the bot (reads `../runs` from disk).
- **Option A**: Deployed on **Vercel**; does **not** have access to bot filesystem. It calls a **read-only API on Hetzner** that serves the same data (run list, run by date, health, optionally account).

---

## Pages / tabs and what they show

| Route | Purpose |
|-------|--------|
| **/** (Overview) | KPIs: last run time, bets attempted/succeeded, DRY_RUN count, next target (12:00 UTC). Bot account card (if `/api/account` available). 7-day success rate trend (line chart), stake volume per day (bar chart). |
| **/runs** | Table of run summaries: date, runId, time UTC, forecast count, success / dry / failed. Filter: All, Success, Failed, Dry run. Link “Details” → `/runs/[date]`. |
| **/runs/[date]** | Full run artifact for that date: forecasts, betParams, results (txId, status, errors). |
| **/account** | Bot account: accountId, network, balance (from Mirror); recent transactions (from Mirror). Depends on `/api/account` (server-side env: ACCOUNT_ID, NETWORK). |

---

## What API endpoints it will call in Option A

When the dashboard is on Vercel, set `NEXT_PUBLIC_BETTING_API_BASE` (or similar) to the Hetzner read-only API base URL. The dashboard then calls:

| Endpoint | Method | Purpose |
|----------|--------|--------|
| `{base}/api/betting/runs` | GET | List run summaries (dates, counts, success/failed/dry). |
| `{base}/api/betting/runs/:date` | GET | Full run artifact for `YYYY-MM-DD`. |
| `{base}/api/resolver/runs` | GET | List resolver run IDs (and optionally summary fields). |
| `{base}/api/resolver/runs/:id` | GET | Full resolver run artifact by runId. |
| `{base}/api/health` | GET | Combined health: last betting run, next target, last resolver run, etc. |
| `{base}/api/account` | GET | (Optional) Bot account + balance + recent txs from Mirror. |

All requests must include: `Authorization: Bearer <DASHBOARD_API_TOKEN>`.

---

## Data contracts expected from those endpoints

### GET /api/betting/runs

**Response**: array of run summaries.

```json
[
  {
    "date": "2025-03-10",
    "runId": "uuid",
    "timestampUtc": "2025-03-10T14:00:00.000Z",
    "forecastCount": 1,
    "betParamCount": 1,
    "resultCount": 1,
    "successCount": 1,
    "dryRunCount": 0,
    "skippedCount": 0,
    "failedCount": 0
  }
]
```

### GET /api/betting/runs/:date

**Response**: full run artifact (same shape as `01-torch-agent-kit-bot.md` run artifact). `:date` = `YYYY-MM-DD`.

### GET /api/resolver/runs

**Response**: list of resolver runs (e.g. for dropdown or table).

```json
{
  "runs": [
    { "runId": "RESOLVE-2025-03-10T14-00-00", "name": "RESOLVE-2025-03-10T14-00-00.json" }
  ]
}
```

### GET /api/resolver/runs/:id

**Response**: full resolver run artifact (see `03-torch-oracle-resolver.md`). `:id` = runId (filename without `.json`).

### GET /api/health

**Response**: combined summary for Overview.

```json
{
  "lastRun": {
    "date": "2025-03-10",
    "timestampUtc": "2025-03-10T14:00:00.000Z",
    "successCount": 1,
    "dryRunCount": 0,
    "failedCount": 0,
    "skippedCount": 0
  },
  "nextTargetTimestamp": 1741234567,
  "nextTargetDate": "2025-03-11T12:00:00.000Z",
  "lastResolverRun": { "runId": "RESOLVE-2025-03-10T12-00-00", "timestampUtc": "..." }
}
```

### GET /api/account (optional)

**Response**: bot account info (e.g. from Mirror Node). No secrets.

```json
{
  "accountId": "0.0.xxxxx",
  "network": "testnet",
  "balance": { "hbar": 10.5, "tinybar": "1050000000" },
  "transactions": [...]
}
```

---

## Caching / revalidation notes

- Dashboard uses `revalidate: 10` (or similar) on API routes when it serves its own data; with Option A, the **Hetzner API** is the source of truth.
- Vercel app can set short cache (e.g. 10–60s) for `fetch()` to the API or use SWR/React Query with a few seconds stale time so the UI feels fresh without hammering the API.
