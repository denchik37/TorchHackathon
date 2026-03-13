# Runbooks

## Local runbook

### How to run the bet bot locally in dry-run

1. From repo root: `cd torch-agent-kit-bot`.
2. Copy `.env.example` to `.env`; set at least `ACCOUNT_ID`, `PRIVATE_KEY`, `NETWORK`, `TORCH_CONTRACT_ID`, `OPENAI_API_KEY`.
3. Set `DRY_RUN=true` in `.env`.
4. Run: `npm run daily`.
5. Check: `runs/YYYY-MM-DD.json` should exist; `results[].dryRun` should be true and no real tx sent.

### How to run the resolver locally in dry-run

1. From repo root: `cd torch-oracle-resolver`.
2. Copy `.env.example` to `.env`; set `ADMIN_ACCOUNT_ID`, `ADMIN_PRIVATE_KEY`, `NETWORK`, `TORCH_CONTRACT_ID`, `SUBGRAPH_URL`.
3. Set `DRY_RUN=true` in `.env`.
4. Run: `npm run resolve:once`.
5. Check: `runs/RESOLVE-*.json` and optionally `state.json`; no contract txs if DRY_RUN.

### How to verify artifacts

- **Bot**: `cat torch-agent-kit-bot/runs/2025-03-10.json | jq '.results'`. Expect one entry per target; `txId` and `status: 22` only when not DRY_RUN and not skipped.
- **Resolver**: `ls torch-oracle-resolver/runs/`. Open latest `RESOLVE-*.json`; check `priceChecks`, `txs.setPricesBatchTxIds`, `bucketResults`, `errors`.

---

## Hetzner runbook

### Folder layout (suggested)

```
/opt/
  torch-agent-kit-bot/
    .env              # bot env (never commit)
    runs/             # YYYY-MM-DD.json
    src/ ...
  torch-oracle-resolver/
    .env              # resolver env (never commit)
    runs/             # RESOLVE-*.json
    state.json
    src/ ...
  torch-api/          # Optional: read-only API app
    .env              # DASHBOARD_API_TOKEN, BETTING_RUNS_DIR, RESOLVER_RUNS_DIR
```

### Env file locations

- Bot: `/opt/torch-agent-kit-bot/.env`
- Resolver: `/opt/torch-oracle-resolver/.env`
- Read-only API: `/opt/torch-api/.env` (Option A)

### Systemd service + timer plan (described)

- **Bot**: One-shot service that runs `npm run daily` in the bot dir; timer once per day (e.g. 08:00 UTC).
- **Resolver**: One-shot service that runs `npm run resolve:once` in the resolver dir; timer every 15 minutes (or as configured).
- **API**: Long-running service (e.g. `node server.js` or `npm run start`) listening on PORT; no timer.

Example (conceptual only; not implemented in repo):

```ini
# /etc/systemd/system/torch-bet-bot.service
[Unit]
Description=Torch daily bet run
After=network.target
[Service]
Type=oneshot
User=torch
WorkingDirectory=/opt/torch-agent-kit-bot
EnvironmentFile=/opt/torch-agent-kit-bot/.env
ExecStart=/usr/bin/npm run daily
[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/torch-bet-bot.timer
[Unit]
Description=Run Torch bet bot daily
[Timer]
OnCalendar=*-*-* 08:00:00 UTC
Persistent=yes
[Install]
WantedBy=timers.target
```

### Log locations and commands

- **journalctl** for systemd-managed services:
  - `journalctl -u torch-bet-bot.service -n 100`
  - `journalctl -u torch-oracle-resolver.service -n 100`
  - `journalctl -u torch-bet-bot.timer -u torch-oracle-resolver.timer --since today`
- If processes log to files, document path (e.g. `/var/log/torch/bot.log`) and rotation.

---

## Vercel runbook

### How to configure env vars (API base URL + token)

1. Vercel project → Settings → Environment Variables.
2. Add:
   - `NEXT_PUBLIC_BETTING_API_BASE` (or `NEXT_PUBLIC_API_BASE`) = `https://torch-api.example.com` (no trailing slash).
   - `DASHBOARD_API_TOKEN` = same value as Hetzner `DASHBOARD_API_TOKEN` (secret; do not expose to client if possible — use server-side fetch with token).
3. If the dashboard uses client-side fetch to the API, the token must be passed via a server-side API route that proxies the request with the header, or use a short-lived public “read” token if acceptable.

### How to validate dashboard is fetching data

1. Open dashboard Overview; check “Last run” and “Next target” are populated.
2. Open Runs; check table lists dates and counts.
3. Open a run detail; check forecasts and results match artifact.
4. (Option A) Open network tab; verify requests to `https://torch-api.example.com/api/...` return 200 and JSON; 401 without token.

---

## Incident runbook

### What to do if the bot stops

1. Check timer and service: `systemctl status torch-bet-bot.timer` and `torch-bet-bot.service`.
2. Run manually: `cd /opt/torch-agent-kit-bot && npm run daily`; inspect logs and `runs/` for errors.
3. Check env: `.env` present; `OPENAI_API_KEY`, `PRIVATE_KEY`, `TORCH_CONTRACT_ID` valid.
4. Check Hedera network/balance; check OpenAI quota/errors.

### What to do if the resolver blocks too many timestamps

1. Inspect `torch-oracle-resolver/state.json` and latest `runs/RESOLVE-*.json`; look at `priceChecks` where `status === "blocked"` and `blockedTimestamps`.
2. If CoinGecko vs oracle divergence is consistently high: consider increasing `MAX_PRICE_DIVERGENCE_PCT` temporarily, or fix oracle feed / use different oracle.
3. If CoinGecko is missing data: consider manual override (e.g. run admin UI once to set prices for that timestamp) or backfill script.
4. Clear a blocked timestamp from `state.blockedTimestamps` only after verifying the intended price source.

### What to do if the subgraph is lagging

1. Check subgraph sync status (Graph Studio or deployment dashboard).
2. Resolver and frontends will show stale “unresolved” data until subgraph catches up.
3. No need to re-run resolver for already-submitted txs; once subgraph is current, next resolver run will pick up remaining work.
4. If critical, consider pausing resolver until subgraph is healthy to avoid duplicate or confusing state.
