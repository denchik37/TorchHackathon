# Hetzner layout (Option A)

Suggested paths. Create dirs and env files; do not commit secrets.

## Env files (e.g. under /etc/torch/)

- `/etc/torch/torch-api.env` — PORT=3001, DASHBOARD_API_TOKEN, BETTING_RUNS_DIR, RESOLVER_RUNS_DIR
- `/etc/torch/torch-bet-bot.env` — ACCOUNT_ID, PRIVATE_KEY, NETWORK, TORCH_CONTRACT_ID, OPENAI_API_KEY, etc.
- `/etc/torch/torch-oracle-resolver.env` — ADMIN_ACCOUNT_ID, ADMIN_PRIVATE_KEY, NETWORK, TORCH_CONTRACT_ID, SUBGRAPH_URL, RESOLVER_RUNS_DIR, RESOLVER_STATE_PATH, etc.

## App and data dirs (e.g. /opt and /var/lib)

- `/opt/torch-api` — torch-api package (clone or copy); `npm run build && npm start`
- `/opt/torch-agent-kit-bot` — bet bot repo; writes `runs/YYYY-MM-DD.json` under this dir
- `/opt/torch-oracle-resolver` — resolver package; writes `runs/RESOLVE-*.json` and `state.json` under this dir
- `/var/lib/torch` — optional: shared or symlinks for runs dirs if you want a single data root

## BETTING_RUNS_DIR / RESOLVER_RUNS_DIR

Set in torch-api.env to the actual run artifact dirs, e.g.:

- BETTING_RUNS_DIR=/opt/torch-agent-kit-bot/runs
- RESOLVER_RUNS_DIR=/opt/torch-oracle-resolver/runs

For the resolver, you can use a shared data root: set `RESOLVER_RUNS_DIR=/var/lib/torch/resolver-runs` and `RESOLVER_STATE_PATH=/var/lib/torch/resolver-state/state.json` in torch-oracle-resolver.env, and point torch-api’s `RESOLVER_RUNS_DIR` to the same path.
