# Torch System Overview

## High-level architecture

- **Vercel**: Public frontends (main Torch app + optional Agent Kit dashboard UI).
- **Hetzner**: Ops workloads — subgraph, bet bot, oracle resolver; optionally a **read-only API** for dashboards (Option A).
- **Data flow**: Bot places bets on Hedera → contract emits events → subgraph indexes → UIs and resolver read from subgraph. Resolver submits prices and `processBatch` on the same contract.

```
                    +------------------+
                    |   Vercel (UI)    |
                    | - Main frontend  |
                    | - /oracle        |
                    +--------+---------+
                             |
         Option A:            |  HTTPS (DASHBOARD_API_TOKEN)
         read-only API        v
                    +------------------+
                    |  Hetzner: API    |
                    | /api/betting/*   |
                    | /api/resolver/*  |
                    | /api/health      |
                    +--------+---------+
                             |
         reads from           |
         local disk           v
    +-------------+   +------------------+   +------------------+
    | Bet bot     |   | Oracle resolver  |   | Subgraph         |
    | runs/       |   | runs/ state.json |   | (Hetzner)        |
    +-------------+   +------------------+   +--------+---------+
             |                   |                     |
             | placeBet          | setPrices +          | GraphQL
             v                   v processBatch        v
                    +------------------------------------------+
                    |         Hedera (TorchPredictionMarket)   |
                    +------------------------------------------+
```

## Component list and responsibilities

| Component | Location | Role |
|-----------|----------|------|
| **Torch Agent Kit Bot** | `./torch-agent-kit-bot` | Daily run: OpenAI forecast → parse Min/Max → place one bet per eligible 12:00 UTC target on Hedera. Writes `runs/YYYY-MM-DD.json`. |
| **Betting Dashboard** | `./torch-agent-kit-bot/dashboard` | Read-only Next.js UI: Overview, Runs list, Run detail by date, Account (Mirror). Reads `../runs` (or Option A: remote API). |
| **Torch Oracle Resolver** | `./torch-oracle-resolver` | Backlog-capable resolver: subgraph → eligible timestamps → CoinGecko + oracle check → `setPricesForTimestamps` + `processBatch`. Writes `runs/RESOLVE-*.json`, `state.json`. |
| **Subgraph** | Deployed on Hetzner | Indexes TorchPredictionMarket events; GraphQL for bets, buckets, users. |
| **Main frontend** | Vercel | Torch app: place bets, my-bets, admin (manual resolution), **/oracle** (public Oracle dashboard). |

## Data flow (summary)

1. **Bot**: Cron/scheduler → `npm run daily` → targets (12:00 UTC, lead time) → OpenAI → parse → `placeBet` (Hedera) → persist `runs/YYYY-MM-DD.json`.
2. **Resolver**: Cron/timer → `npm run resolve:once` → subgraph (unresolved bets/buckets) → price check → `setPricesForTimestamps` (batched) → `processBatch` per bucket → persist `runs/RESOLVE-*.json` and `state.json`.
3. **Dashboard (Option A)**: Vercel app calls Hetzner API with `Authorization: Bearer DASHBOARD_API_TOKEN`; API reads `runs/` and resolver `runs/` from disk and returns JSON. No secrets in responses.

## Key security constraints

- **Secrets only on Hetzner**: `PRIVATE_KEY`, `ADMIN_PRIVATE_KEY`, `OPENAI_API_KEY` — never in frontend or in the read-only API responses.
- **Dashboards are read-only**: They display run artifacts and account info; they do not execute bets or resolver txs.
- **Option A API**: Protected by bearer token; rate limiting at nginx; only returns run metadata and artifact JSON (no env, no keys).
