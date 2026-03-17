# 🔥 Torch

> A decentralized, AI-powered prediction market protocol for crypto price discovery, built on **Hedera**.

![License](https://img.shields.io/github/license/denchik37/TorchOriginsHackathon)
![Deploy](https://img.shields.io/badge/deploy-Hedera_Mainnet-2ea44f)

---

## Table of Contents

- [What Is Torch?](#-what-is-torch)
- [Value Proposition](#-value-proposition)
- [Hackathon Scope](#-hackathon-scope)
- [Architecture & Deployment](#-architecture--deployment)
- [Repo Structure & Services](#-repo-structure--services)
- [Environment Variables](#-environment-variables)
- [How It Works (Step-by-Step)](#-how-it-works-torchpredictionmarket-step-by-step)
- [Local Development](#-local-development)
- [Automatic Resolution & Oracle Runs](#-automatic-resolution--oracle-runs)
- [Resolver Run Artifacts](#-resolver-run-artifacts)
- [Demo Flow](#-demo-flow)
- [Troubleshooting](#-troubleshooting)
- [Security Notes](#-security-notes)
- [Tech Stack & Installation](#-tech-stack--installation)
- [Team & Resources](#-team--resources)

---

## 🌍 What Is Torch?

**Torch** is a decentralized prediction system for high-resolution, real-time **crypto price forecasting**.

Unlike conventional markets focused on **binary outcomes** (e.g. Polymarket), Torch allows users to predict **price ranges across future timepoints**, creating a **dynamic price–time probability surface**.

Torch blends **AI agents** and **human traders** in an **InfoFi-aligned ecosystem**, rewarding **early**, **sharp**, and **high-conviction** predictions.

---

## 💎 Value Proposition

| Problem | Torch's Solution |
|--------|-------------------|
| Crypto traders lack continuous, high-resolution price forecasts | Torch builds a real-time price–time signal |
| Existing markets are binary or categorical | Torch enables continuous predictions on a full probability surface |
| Fragmented market signals and incentives | Torch aligns humans and AI agents via economic incentives |

---

## 🏁 Hackathon Scope

- ✅ Core smart contracts for prediction lifecycle and payout logic  
- ✅ Graph subgraph indexing for event querying  
- ✅ Wallet-authenticated frontend  
- ✅ Realistic price resolution and reward distribution  

**Specs:** [Functional & Contract](https://docs.google.com/document/d/1aKkVzq7iILSpPRT327vxOGVfcCCzwlWwrrcCx9HPXnA/edit) · [Design & Frontend](https://docs.google.com/document/d/15gglInxKkXICz9hhw3A2YnUqXs00CRjPEVfndv7MCPY/edit)

---

## 🏗 Architecture & Deployment

Deployment is split between **Vercel** (UI and server-side proxy) and **Hetzner** (execution, signing, and artifact persistence). The resolver and its private key **never** run on Vercel.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USERS / BROWSER                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         │ GraphQL (/api/subgraph)             │ REST (oracle runs, health)
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────────────────────┐
│  frontend (Vercel)   │            │  dashboard (optional, Vercel/same host)  │
│  Prediction UI,      │            │  Overview, Runs, Resolver runs, Account  │
│  My Bets, Oracle     │            │  Proxies to torch-api when configured    │
└─────────────────────┘            └─────────────────────────────────────────┘
         │                                            │ Bearer token
         │ NEXT_PUBLIC_SUBGRAPH_URL                    ▼
         ▼                                    ┌─────────────────────────────────┐
┌─────────────────────┐                      │  torch-api (Hetzner, port 3001)  │
│  Subgraph (GraphQL) │                      │  Read-only API over JSON files   │
└─────────────────────┘                      │  GET /api/health, resolver/runs  │
                                              └─────────────────────────────────┘
                                                              │
                                    BETTING_RUNS_DIR,         │ reads from disk
                                    RESOLVER_RUNS_DIR         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  HETZNER                                                                      │
│  /var/lib/torch/resolver-runs (or /opt/.../runs) — RESOLVE-*.json            │
│  /var/lib/torch/resolver-state/state.json — resolver state                   │
│  Bet bot runs: torch-agent-kit-bot/runs/YYYY-MM-DD.json                       │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ placeBet()                         │ setPricesForTimestamps, processBatch
┌─────────────────────┐                      ┌─────────────────────────────────┐
│  torch-agent-kit-bot│                      │  torch-oracle-resolver            │
│  (systemd timer)    │                      │  (systemd timer, e.g. every 15m)  │
└─────────────────────┘                      └─────────────────────────────────┘
                              Hedera network · TorchPredictionMarket contract
```

**Summary**

- **Vercel:** Frontend and (optionally) dashboard. Oracle routes **proxy** to Hetzner `torch-api`; no resolver execution, no resolver private key, no reading resolver artifacts from disk.
- **Hetzner:** `torch-api` (read-only HTTP API), `torch-oracle-resolver` (on-chain writes, state and run artifacts), `torch-agent-kit-bot` (daily bets). systemd timers drive resolver and bot; torch-api reads artifacts from configured dirs (e.g. `/var/lib/torch/resolver-runs`, resolver state at `/var/lib/torch/resolver-state/state.json`).

---

## 📁 Repo Structure & Services

```
TorchOriginsHackathon/
├── frontend/              # Next.js app (Vercel): prediction UI, my-bets, oracle page
├── smartContracts/        # Hedera Solidity contracts
├── torch-subgraph/        # Graph subgraph for contract events
├── torch-api/             # Read-only API (Hetzner): serves run artifacts
├── torch-oracle-resolver/ # Resolver (Hetzner only): price check + setPrices + processBatch
├── torch-agent-kit-bot/   # Daily bet agent (Hetzner) + optional dashboard
├── ops/                   # systemd units, Hetzner layout notes
├── docs/                  # TORCH-SYSTEM-SUMMARY, torch-ops runbooks
├── README.md
└── LICENSE
```

| Service | Role |
|--------|------|
| **frontend** | Prediction UI, wallet connect, subgraph proxy, Oracle page (proxies to torch-api for run data). |
| **torch-api** | Read-only REST API on Hetzner; serves betting and resolver run artifacts; auth via Bearer token. |
| **torch-oracle-resolver** | Runs only on Hetzner; fetches unresolved bets, checks prices (CoinGecko + oracle), calls `setPricesForTimestamps` and `processBatch`; writes `RESOLVE-*.json` and `state.json`. |
| **torch-agent-kit-bot** | Daily job on Hetzner; OpenAI forecast, places bets; writes `runs/YYYY-MM-DD.json`. Optional **dashboard** in `torch-agent-kit-bot/dashboard` shows runs and proxies to torch-api. |

---

## 🔧 Environment Variables

Copy the relevant `.env.example` in each app and set values. **Never commit real secrets.**

| Service | Key vars | Notes |
|--------|----------|--------|
| **frontend** | `NEXT_PUBLIC_SUBGRAPH_URL`, `NEXT_PUBLIC_CONTRACT_ID`, `TORCH_API_BASE`, `DASHBOARD_API_TOKEN` | `TORCH_API_BASE` and `DASHBOARD_API_TOKEN` are **server-only**; Oracle page proxies to Hetzner torch-api. |
| **torch-api** | `PORT`, `DASHBOARD_API_TOKEN`, `BETTING_RUNS_DIR`, `RESOLVER_RUNS_DIR` | Reads artifacts from disk; token required for dashboard/frontend proxy. |
| **torch-oracle-resolver** | `NETWORK`, `ADMIN_ACCOUNT_ID`, `ADMIN_PRIVATE_KEY`, `TORCH_CONTRACT_ID`, `SUBGRAPH_URL`, `RESOLVER_RUNS_DIR`, `RESOLVER_STATE_PATH` | Resolver runs **only on Hetzner**; in production set `RESOLVER_RUNS_DIR=/var/lib/torch/resolver-runs`, `RESOLVER_STATE_PATH=/var/lib/torch/resolver-state/state.json`. |
| **torch-agent-kit-bot** | `ACCOUNT_ID`, `PRIVATE_KEY`, `NETWORK`, `TORCH_CONTRACT_ID`, `OPENAI_API_KEY` | Writes to `./runs`; torch-api’s `BETTING_RUNS_DIR` must point to that dir on the server. |
| **dashboard** (in bot repo) | `TORCH_API_BASE`, `DASHBOARD_API_TOKEN`, `BOT_ACCOUNT_ID`, `BOT_NETWORK` | Proxies to torch-api; does not run resolver. |

See each app’s `.env.example` for full, commented lists.

---

## 📚 How It Works: TorchPredictionMarket Step-by-Step

1. **Place bets** — Users (or the bot) call `placeBet(targetTimestamp, priceMin, priceMax)` with HBAR.
2. **Weighting** — Contract weights bets by precision (sharpness).
3. **Oracle resolves price** — Resolver calls `setPricesForTimestamps(timestamps, prices)` with the reference price (e.g. CoinGecko + oracle check).
4. **Process results** — Resolver calls `processBatch(bucketIndex)` until buckets are aggregation-complete.
5. **Winnings** — Users claim via contract; payouts follow contract logic.

---

## 🛠 Local Development

```bash
git clone https://github.com/denchik37/TorchOriginsHackathon
cd TorchOriginsHackathon
```

Install and run per service:

```bash
# Frontend
cd frontend && cp .env.example .env && npm install && npm run dev

# torch-api (needs BETTING_RUNS_DIR and RESOLVER_RUNS_DIR pointing to existing dirs)
cd torch-api && cp .env.example .env && npm install && npm run dev

# Resolver (local: uses ./runs and ./state.json if RESOLVER_RUNS_DIR/RESOLVER_STATE_PATH unset)
cd torch-oracle-resolver && cp .env.example .env && npm install && npm run resolve:once

# Bet bot
cd torch-agent-kit-bot && cp .env.example .env && npm install && npm run daily
```

Frontend Oracle page shows resolver run data only when `TORCH_API_BASE` and `DASHBOARD_API_TOKEN` are set and torch-api is reachable; otherwise it returns an empty list and a message.

---

## ⏱ Automatic Resolution & Oracle Runs

- **Resolver:** Triggered by systemd timer on Hetzner (e.g. every 15 minutes). Optional manual trigger must be a **Hetzner-side** endpoint (e.g. protected by `RESOLVER_TRIGGER_SECRET`); the frontend `POST /api/oracle/trigger` returns 501 and does not run the resolver.
- **Artifacts:** Resolver writes `RESOLVE-<runId>.json` under `RESOLVER_RUNS_DIR` and state to `RESOLVER_STATE_PATH`. torch-api reads these dirs and exposes `GET /api/resolver/runs` and `GET /api/resolver/runs/:id`.
- **Frontend/dashboard:** Call their own `/api/oracle/runs` (or equivalent), which **proxy** to torch-api with the Bearer token; they never read the filesystem or run the resolver.

---

## 📋 Resolver Run Artifacts

Each resolver run produces a JSON artifact (e.g. in torch-api responses and on disk). Useful fields:

| Field | Meaning |
|-------|--------|
| **acceptedCount** | Number of timestamps that passed price check and were submitted (setPrices). |
| **blockedCount** | Timestamps blocked (e.g. oracle divergence &gt; `MAX_PRICE_DIVERGENCE_PCT`). |
| **setPricesBatchTxIds** | Hedera transaction IDs for `setPricesForTimestamps` batches. |
| **processBatchTxIds** | Per-bucket list of transaction IDs for `processBatch` calls. |

---

## 🎬 Demo Flow

1. **Frontend:** Open prediction page, connect wallet, place a bet (or show existing bets and Oracle page).
2. **Oracle page:** Show resolver runs and run detail (data comes from torch-api via frontend proxy when `TORCH_API_BASE` and `DASHBOARD_API_TOKEN` are set).
3. **Dashboard (optional):** Open bot dashboard; show Overview (last betting run, last resolver run), Runs list, Resolver runs, Account (from Mirror).
4. **Backend:** Emphasize resolver and bot run on Hetzner only; Vercel only serves UI and proxies to torch-api.

---

## 🔧 Troubleshooting

- **Oracle page shows no runs:** Ensure frontend has `TORCH_API_BASE` and `DASHBOARD_API_TOKEN` set, torch-api is running on Hetzner, and `RESOLVER_RUNS_DIR` points to where resolver writes `RESOLVE-*.json`.
- **401 from torch-api:** Check `DASHBOARD_API_TOKEN` matches on torch-api and on the client (frontend/dashboard) that proxies to it.
- **Resolver not writing runs:** Check `RESOLVER_RUNS_DIR` and `RESOLVER_STATE_PATH` (and dir permissions); run `npm run resolve:once` locally with `DRY_RUN=true` to test.
- **Docs:** See `docs/TORCH-SYSTEM-SUMMARY.md` and `docs/torch-ops/` for runbooks and Option A layout.

---

## 🔒 Security Notes

- Resolver **private key** and execution stay on **Hetzner only**; never on Vercel or in the frontend.
- `TORCH_API_BASE` and `DASHBOARD_API_TOKEN` are **server-side only**; do not expose them with `NEXT_PUBLIC_`.
- torch-api is read-only and does not return secrets; all requests require a valid Bearer token.
- Rotate `DASHBOARD_API_TOKEN` and any trigger secret if they might have been exposed.

**Known limitations:** Resolver and bot runs are scheduled on Hetzner (systemd); no in-repo Kubernetes or serverless resolver. Frontend Oracle trigger is intentionally disabled on Vercel (501); use a Hetzner-side endpoint for manual triggers.

---

## 💻 Tech Stack & Installation

- **Contracts:** Hardhat, Solidity ^0.8.0; Foundry optional.
- **Chain:** Hedera (Hashgraph, JSON-RPC, HashScan).
- **Frontend:** Next.js, React, TypeScript, GraphQL Apollo, Clerk, HashConnect.
- **Indexing:** Graph Protocol subgraph; Graph Node on VPS.
- **Hosting:** Vercel (frontend); Hetzner (torch-api, resolver, bet bot, subgraph).

```bash
cd smartContracts && npm install
cd torch-subgraph && npm install
cd frontend && npm install
```

---

## 🤝 Team & Resources

| Name | Role |
|------|------|
| Denis Igin | PM, Marketing |
| Balut Catalin-Mihai | Smart Contract Developer |
| Sebastien Guibert | Blockchain Data Integration / Architect |
| Sebastian Balaj | Frontend Developer |
| Mohammad Hatif Osmani | Frontend Developer |

| Resource | URL |
|----------|-----|
| Web | [torch.bet](https://torch.bet) |
| Litepaper | [torch-1.gitbook.io/litepaper](https://torch-1.gitbook.io/litepaper) |
| Blog | [Medium](https://medium.com/torch-token-price-forecasting) |
| X (Twitter) | [@torchbet](https://x.com/torchbet) |
