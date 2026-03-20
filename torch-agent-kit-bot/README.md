# Daily Torch Bet Agent (Hedera Agent Kit / SDK)

This runner (`npm run daily:agentkit`) generates deterministic price forecasts with OpenAI and executes (or parse-only) the Torch contract `placeBet(...)` via `TORCH_PLACE_BET_TOOL` from the local `torch-plugin`.

## What it does

1. Computes eligible target days at **12:00 UTC** using:
   - `MIN_TARGET_LEAD_SECONDS` (default `86400`) to avoid "Target too soon"
   - `DAYS_AHEAD` to control the forecast/execution horizon (set to `7` for the next 7 eligible days).
2. For each eligible target day:
   - Generates exactly one forecast line in the format `Min: x, Max: y`.
   - Calls `TORCH_PLACE_BET_TOOL` with:
     - `forecastRaw` (the exact forecast line)
     - `execute=true` only when it should actually place the bet (respects duplicates + `DRY_RUN`).
3. Writes a run artifact to `./runs/YYYY-MM-DD.json` with `forecasts[]`, `betParams[]`, and `results[]`.
4. Idempotency: if a bet (keyed by `SYMBOL:targetTimestamp`) already has a successful on-chain tx (receipt status `22`), the runner records `skippedDuplicate: true` and does not re-execute.

## Setup

- **Node 20+**, TypeScript strict, ESM.
- Copy `.env.example` to `.env` and fill in:
  - `ACCOUNT_ID`, `PRIVATE_KEY` (DER or raw supported by SDK)
  - `NETWORK` (testnet | mainnet)
  - `TORCH_CONTRACT_ID` (Hedera contract id)
  - `OPENAI_API_KEY`

```bash
cp .env.example .env
# edit .env
npm install
```

## Run

- **Dry run** (no on-chain tx, writes artifact only):

  ```bash
  DRY_RUN=true npm run daily:agentkit
  ```

- **Live** (after removing or setting `DRY_RUN=false`):

  ```bash
  DRY_RUN=false npm run daily:agentkit
  ```

## Scheduling

Run once per day at **12:00 UTC** (the bot’s daily anchor). Example cron (12:00 UTC):

```cron
0 12 * * * cd /path/to/torch-agent-kit-bot && npm run daily:agentkit
```

Or use the provided systemd timer on Hetzner:
- `ops/torch-option-a/systemd/torch-bet-bot.timer`
- `ops/torch-option-a/systemd/torch-bet-bot.service`

## How it avoids "Target too soon"

- `MIN_TARGET_LEAD_SECONDS` (default `86400` = 24h) defines an **anchor** = now + 24h.
- The first target is the **next 12:00 UTC** that is ≥ that anchor.
- So the target is always at least 24 hours in the future.

## Idempotency / no duplicates

- Each bet is keyed by `SYMBOL:targetTimestamp` (e.g. `HBAR:1740787200`).
- Before placing, the bot loads `runs/YYYY-MM-DD.json` and checks if that `betKey` already has a successful transaction (by `txId` and status).
- If yes, it **skips** and records `skippedDuplicate: true` in the artifact.
- Re-running the same day is safe: already-placed bets are not sent again.

## Run artifacts

- Path: `./torch-agent-kit-bot/runs/YYYY-MM-DD.json`
- Contains: `runId`, `timestampUtc`, `provider` (model, reasoning_effort, max_completion_tokens), `forecasts[]`, `betParams[]`, `results[]` (dryRun / skippedDuplicate / txId / status / error).

## Dashboard

A read-only Next.js dashboard under `./dashboard` can list runs, show forecasts, bet params, and results. Start it with:

```bash
npm run dashboard:dev
```

See `dashboard/README.md` for deployment (e.g. Hetzner + reverse proxy).

## Scripts

| Script            | Description                    |
|-------------------|--------------------------------|
| `npm run daily:agentkit` | LangChain + Hedera Agent Kit tool calling (production) |
| `npm run daily`   | Legacy deterministic runner (optional fallback) |
| `npm run dev`     | Watch mode (tsx)               |
| `npm run build`   | Compile TypeScript             |
| `npm run test`    | Run vitest                     |
| `npm run lint`    | ESLint                         |
| `npm run dashboard:dev`   | Start dashboard dev server     |
| `npm run dashboard:build` | Build dashboard                |
| `npm run dashboard:start` | Start dashboard production     |
