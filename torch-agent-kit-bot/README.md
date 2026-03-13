# Daily Torch Bet Agent (Hedera Agent Kit / SDK)

This bot places one bet per day for the **next eligible target day** at 12:00 UTC, using OpenAI GPT-5.2 for the forecast and the **Hedera SDK** (Agent Kit style: operator `ACCOUNT_ID` + `PRIVATE_KEY`) to submit the transaction.

## What it does

1. Computes the next eligible target day at **12:00 UTC** with a minimum **24h lead time** (configurable) to avoid "Target too soon".
2. Calls OpenAI Chat Completions (GPT-5.2–compatible: `max_completion_tokens`, `reasoning_effort`, no `temperature`) to get a single line: `Min: [x], Max: [y]`.
3. Parses the line (bracketed or plain, optional trailing period).
4. Encodes prices as 8-decimal fixed-point (same as frontend) and builds `placeBet(targetTimestamp, priceMin, priceMax)` payable via **ContractExecuteTransaction**.
5. Persists a run artifact to `./runs/YYYY-MM-DD.json` (idempotency: skips if that betKey already has a successful tx for the day).

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
  DRY_RUN=true npm run daily
  ```

- **Live** (after removing or setting `DRY_RUN=false`):

  ```bash
  npm run daily
  ```

## Scheduling

Run once per day so that the "next eligible" target is always the same calendar day. Example cron (12:00 UTC):

```cron
0 12 * * * cd /path/to/torch-agent-kit-bot && npm run daily
```

Or use systemd timer / your scheduler to run at 12:00 UTC.

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
| `npm run daily`   | Run daily bet once             |
| `npm run dev`     | Watch mode (tsx)               |
| `npm run build`   | Compile TypeScript             |
| `npm run test`    | Run vitest                     |
| `npm run lint`    | ESLint                         |
| `npm run dashboard:dev`   | Start dashboard dev server     |
| `npm run dashboard:build` | Build dashboard                |
| `npm run dashboard:start` | Start dashboard production     |
