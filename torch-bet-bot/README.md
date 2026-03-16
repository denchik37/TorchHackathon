# Torch Bet Bot

A **daily betting agent** for the Torch prediction market on Hedera. It fetches HBAR price forecasts from **OpenAI (ChatGPT)**, converts them into deterministic bet parameters, and submits onchain bets—or runs in dry-run mode for safety. Designed as a headless bot (e.g. on Hetzner) using a Hedera account whose key is also manageable in HashPack.

## What it does

- **Fetches** structured token price forecasts for the next 7 days (D+1 … D+7), each targeting **12:00 UTC** on that day, via **OpenAI** with a fixed prompt (60% probability min/max range, e.g. `Min: 0.09300, Max: 0.11000`).
- **Converts** forecasts to Torch contract params (fixed-point price integers, HBAR stake for `msg.value` in weibar).
- **Submits** bets to the Torch EVM contract on Hedera (or logs only when `DRY_RUN=true`). Signs with **ECDSA secp256k1**. Hedera EVM `msg.value` uses **18 decimals (weibar)**; minimum non-zero is 1 tinybar = 10^10 weibar.
- **Idempotent** — same-day re-runs skip bets already recorded as successful.
- **Guardrails** — `MAX_DAILY_SPEND_HBAR`, optional `MAX_BET_AMOUNT_HBAR`, and `DRY_RUN`.

## HashPack & Keys

- **HashPack-linked** means: the Hedera account used by the bot is the same account you can import or manage in HashPack; the bot uses its **ECDSA secp256k1 private key** on the server to sign EVM transactions. There is no HashConnect or browser-approval flow.
- **Key type**: This bot requires an **ECDSA secp256k1** private key (0x-prefixed, 32-byte / 64 hex characters). **ED25519** keys or mnemonic-only flows do not work for EVM transaction signing on Hedera. If your key is not in this format, the process will fail at startup with a clear error.
- Use a **hot wallet** with minimal funds; rotate keys if compromised.

## How it works

1. Load and validate env (OpenAI key, Hedera RPC, ECDSA key, contract address). Fail fast on invalid key or RPC.
2. Compute 7 target timestamps (12:00 UTC), starting from the first such noon that is at least **MIN_TARGET_LEAD_SECONDS** ahead (default 1 day). This avoids the Torch "Target too soon" revert; if the bot runs late in the day, the first target may be D+2 automatically. Day labels: "Tomorrow" only when the first target is actually tomorrow (UTC); otherwise "on March 5" style.
3. Call OpenAI for min/max price ranges; parse `Min: x, Max: y` with one retry; skip invalid forecasts (no bet for that day).
4. Convert each valid forecast to Torch bet params; enforce spend caps.
5. For each bet: if already placed today (store), skip; else if `DRY_RUN` log and persist as dry run; else send tx sequentially and persist result.
6. Run artifact is written to `runs/YYYY-MM-DD.json` (provider, prompts, raw responses, parsed min/max, bet params, tx results, skipped duplicates).

## Setup

- **Node.js** ≥ 20.
- Clone and install:

```bash
cd torch-bet-bot
npm install
```

- Copy env template and set variables (see below):

```bash
cp .env.example .env
# Edit .env — never commit it
```

## OpenAI model

The bot uses **gpt-5.2** by default for forecasts. You can override with `OPENAI_MODEL` (e.g. `OPENAI_MODEL=gpt-5.2-chat-latest` for a ChatGPT snapshot). **Newer reasoning models** use `max_completion_tokens` (not `max_tokens`); set `OPENAI_MAX_COMPLETION_TOKENS` (default 128) to allow more output/thinking. They may also support **OPENAI_REASONING_EFFORT** (default `high`); higher effort uses more tokens and cost but can improve range quality. Output is always exactly one line: `Min: [x.xxxxx], Max: [y.yyyyy]`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `RPC_URL` | Yes | Hedera JSON-RPC URL |
| `CHAIN_ID` | Yes | Chain ID (e.g. 295 for mainnet) |
| `TORCH_CONTRACT_ADDRESS` | Yes | Torch contract address (0x…) |
| `TORCH_FUNCTION_NAME` | No | Contract function name if ABI is placeholder (default `placeBet`) |
| `PRIVATE_KEY` | Yes | ECDSA secp256k1 private key (0x + 64 hex). HashPack account key; use hot wallet with limited funds. |
| `BET_AMOUNT_HBAR` | No | Per-bet stake in HBAR (default `0.1`) |
| `MAX_DAILY_SPEND_HBAR` | No | Hard cap for total spend per day (default `1`) |
| `MAX_BET_AMOUNT_HBAR` | No | Optional per-bet cap |
| `DRY_RUN` | No | `true` or `1` to skip sending transactions |
| `PRICE_DECIMALS` | No | Fixed-point decimals for price (default `8`) |
| `NATIVE_VALUE_DECIMALS` | No | Decimals for `msg.value` / weibar (default `18`) |
| `MIN_TARGET_LEAD_SECONDS` | No | Min seconds from now to first target (default `86400` = 1 day); prevents "Target too soon" |
| `OPENAI_MODEL` | No | OpenAI model (default `gpt-5.2`). Use `gpt-5.2-chat-latest` for ChatGPT snapshot behavior. |
| `OPENAI_REASONING_EFFORT` | No | Reasoning effort: `none`, `minimal`, `low`, `medium`, `high`, `xhigh` (default `high`). Higher effort uses more tokens and cost. |
| `OPENAI_MAX_COMPLETION_TOKENS` | No | Max completion tokens (default `128`). Newer reasoning models use this instead of `max_tokens`. |
| `OPENAI_MAX_TOKENS` | No | Legacy; used when `OPENAI_MAX_COMPLETION_TOKENS` is not set. |
| `OPENAI_TEMPERATURE` | No | Sampling temperature 0–2 (default `0.2`). |
| `LOG_LEVEL` | No | Log level (default `info`) |

## Running locally

Single run (forecasts + place bets or dry run):

```bash
npm run daily
```

With dry run (no txs):

```bash
DRY_RUN=true npm run daily
```

Run artifacts are written under `runs/YYYY-MM-DD.json`.

## DRY_RUN

Set `DRY_RUN=true` (or `DRY_RUN=1`) to:

- Fetch forecasts and compute bet params as usual.
- Log each bet that would be placed.
- Persist results with `dryRun: true` in the run artifact.
- Never send transactions or spend funds.

Use this to validate config, OpenAI, and policy before enabling real bets.

## Deployment on Hetzner

- Run the bot as a **headless** process (cron or systemd timer). No browser or HashConnect.
- Provide env via a file that is **not** committed (e.g. `/etc/torch-bet-bot/env`) and source it in cron or use `EnvironmentFile` in systemd.
- **Security**: Use a dedicated ECDSA key and hot wallet with minimal HBAR; rotate keys if compromised; keep `OPENAI_API_KEY` and `PRIVATE_KEY` only in env, never in repo.

### Cron

Run once per day (e.g. 06:00 UTC):

```cron
0 6 * * * . /etc/torch-bet-bot/env && cd /path/to/torch-bet-bot && npm run daily >> /var/log/torch-bet-bot.log 2>&1
```

### systemd service + timer

**Service** `/etc/systemd/system/torch-bet-bot.service`:

```ini
[Unit]
Description=Torch Bet Bot daily run
After=network.target

[Service]
Type=oneshot
User=deploy
WorkingDirectory=/path/to/torch-bet-bot
EnvironmentFile=/etc/torch-bet-bot/env
ExecStart=/usr/bin/npm run daily
StandardOutput=journal
StandardError=journal
```

**Timer** `/etc/systemd/system/torch-bet-bot.timer`:

```ini
[Unit]
Description=Run Torch Bet Bot daily at 06:00 UTC

[Timer]
OnCalendar=*-*-* 06:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable torch-bet-bot.timer
sudo systemctl start torch-bet-bot.timer
```

## Verifying transactions

After a run, use the `txHash` values in `runs/YYYY-MM-DD.json`. Open your Hedera explorer (e.g. HashScan), search for the transaction hash, and confirm the contract (Torch) and method (`placeBet`) with the expected parameters.

## Security notes

- **Secrets**: Never commit `.env` or any file containing `OPENAI_API_KEY` or `PRIVATE_KEY`. Use environment variables on the server only.
- **Hot wallet**: Use a dedicated wallet with limited HBAR for the bot. Rotate keys if compromised.
- **Guardrails**: Set `MAX_DAILY_SPEND_HBAR` and optionally `MAX_BET_AMOUNT_HBAR`. Test with `DRY_RUN=true` first.

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| `Invalid env` / key error | Ensure `PRIVATE_KEY` is 0x-prefixed 64 hex chars (ECDSA secp256k1). ED25519 keys won't work. All required vars set and formats correct. |
| RPC connectivity check failed | Ensure `RPC_URL` is correct and the Hedera JSON-RPC endpoint is reachable. |
| `All forecasts failed` | Check `OPENAI_API_KEY`, model availability, and rate limits. |
| `Total intended spend exceeds MAX_DAILY_SPEND_HBAR` | Reduce `BET_AMOUNT_HBAR` or increase `MAX_DAILY_SPEND_HBAR` (or place fewer bets). |
| Duplicate bet skipped | Expected when re-running the same day; idempotency uses `SYMBOL:targetTimestamp` and today's run file. |
| Tx reverted / "Target too soon" | Torch requires targets at least `MIN_TARGET_LEAD_SECONDS` ahead; increase it or run the bot earlier in the day. |
| Tx reverted | Contract may enforce min/max price or stake; check Torch contract rules and run artifact for the params sent. |
| Empty or malformed run file | Ensure `runs/` is writable; run once with `DRY_RUN=true` and inspect `runs/YYYY-MM-DD.json`. |

## Scripts

- `npm run daily` — run the daily bet flow (entrypoint).
- `npm run build` — compile TypeScript.
- `npm run test` — run Vitest tests.
- `npm run lint` — ESLint.
- `npm run format` — Prettier; `npm run format:check` — check only.
