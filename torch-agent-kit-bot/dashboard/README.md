# Torch Agent Kit — Dashboard

Read-only Next.js dashboard to monitor daily runs, forecasts, bet params, results, and **on-chain account data** for the Torch Agent Kit bot. Styling matches the main Torch frontend (dark theme, vibrant purple, glass cards).

## What it does

- **Overview**: Last run time, bets attempted/succeeded, DRY_RUN badge, next target (12:00 UTC), bot account balance (if configured), 7-day success rate trend, stake volume per day.
- **Runs**: Table of runs by date with filters (all / success / failed / dry-run), link to details.
- **Run details**: Tabs for Forecasts (prompt, raw, min/max), Bets (params, 8dp ints), Transactions (txId, status, copy), Logs (errors, skipped).
- **Account**: On-chain data for the bot account — balance (HBAR) and recent transactions from Hedera Mirror Node. Set `BOT_ACCOUNT_ID` (and optionally `BOT_NETWORK`) to enable.

## Data sources

- **Runs**: JSON files from **`../runs`** (i.e. `torch-agent-kit-bot/runs/`) on the server. No database; no blockchain writes.
- **On-chain**: Hedera Mirror Node REST API (balance + transactions for the bot account). Read-only; no private key in the dashboard.

## Env (dashboard)

Create `dashboard/.env.local` (or `.env`) for optional on-chain data:

```bash
# Optional: same account ID as the bot (no private key)
BOT_ACCOUNT_ID=0.0.xxxxx
BOT_NETWORK=testnet
```

If unset, the Account page and Overview account card show a “not configured” message.

## Start locally

From the **torch-agent-kit-bot** root:

```bash
npm run dashboard:dev
```

Dashboard runs at [http://localhost:3001](http://localhost:3001).

From inside the dashboard folder:

```bash
cd dashboard
npm install
npm run dev
```

## Build & production (live instance)

```bash
npm run dashboard:build
npm run dashboard:start
```

Or from dashboard folder: `npm run build && npm run start`. The app listens on port 3001.

## Run as a live instance (e.g. Hetzner)

1. **Build** (from `torch-agent-kit-bot`):
   ```bash
   npm run dashboard:build
   ```

2. **Run in production** so it keeps running:
   - Option A: `npm run dashboard:start` (or `cd dashboard && npm run start`) and keep the process alive (e.g. with `pm2` or `systemd`).
   - Option B: Use Next.js standalone output: copy `dashboard/.next/standalone` and `dashboard/.next/static` to the server, then run `node server.js` from the standalone folder (set `PORT=3001` if needed).

3. **Reverse proxy**: Put nginx or Caddy in front and proxy to `http://127.0.0.1:3001`.

4. **Env on server**: Set `BOT_ACCOUNT_ID` (and optionally `BOT_NETWORK`) so the Account page and Overview show on-chain data. The dashboard still works without them (runs-only).

Example **systemd** unit (run from repo root so `../runs` is correct):

```ini
[Unit]
Description=Torch Agent Kit Dashboard
After=network.target

[Service]
Type=simple
User=you
WorkingDirectory=/home/you/torch-agent-kit-bot
Environment="BOT_ACCOUNT_ID=0.0.xxxxx"
Environment="BOT_NETWORK=testnet"
ExecStart=/usr/bin/npm run dashboard:start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable torch-dashboard && sudo systemctl start torch-dashboard`.
