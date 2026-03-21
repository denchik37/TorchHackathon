# Hetzner Layout (Option A)

Single-host layout for Torch services on Hetzner.  
Goal: keep app code in `/opt`, config in `/etc/torch`, and runtime artifacts in stable run directories.

## 1) Service Overview

| Service | Code Path | Primary Output |
|---|---|---|
| `torch-api` | `/opt/torch-api` | API on `PORT=3001` |
| `torch-agent-kit-bot` | `/opt/torch-agent-kit-bot` | betting run artifacts |
| `torch-oracle-resolver` | `/opt/torch-oracle-resolver` | resolver run artifacts + resolver state |

## 2) Environment Files

Keep env files in `/etc/torch`:

- `/etc/torch/torch-api.env`
  - `PORT=3001`
  - `DASHBOARD_API_TOKEN`
  - `BETTING_RUNS_DIR`
  - `RESOLVER_RUNS_DIR`
- `/etc/torch/torch-bet-bot.env`
  - `ACCOUNT_ID`, `PRIVATE_KEY`, `NETWORK`
  - `TORCH_CONTRACT_ID`
  - `OPENAI_API_KEY`
  - other bot-specific settings
- `/etc/torch/torch-oracle-resolver.env`
  - `ADMIN_ACCOUNT_ID`, `ADMIN_PRIVATE_KEY`, `NETWORK`
  - `TORCH_CONTRACT_ID`, `SUBGRAPH_URL`
  - `RESOLVER_RUNS_DIR`
  - `RESOLVER_STATE_PATH`
  - other resolver-specific settings

## 3) Directory Layout

- `/opt/torch-api`
  - API package (typically `npm run build && npm start`)
- `/opt/torch-agent-kit-bot`
  - bot repo, writes betting artifacts under `runs/`
- `/opt/torch-oracle-resolver`
  - resolver package, writes resolver artifacts and state
- `/var/lib/torch` (optional but recommended)
  - shared persistent data root for run/state files

## 4) Run Artifact Paths

In `/etc/torch/torch-api.env`, point to actual artifact locations:

- `BETTING_RUNS_DIR=/opt/torch-agent-kit-bot/runs`
- `RESOLVER_RUNS_DIR=/opt/torch-oracle-resolver/runs`

### Optional Shared Data Root

If you want cleaner persistence and backups, use `/var/lib/torch`:

- In `torch-oracle-resolver.env`:
  - `RESOLVER_RUNS_DIR=/var/lib/torch/resolver-runs`
  - `RESOLVER_STATE_PATH=/var/lib/torch/resolver-state/state.json`
- In `torch-api.env`:
  - `RESOLVER_RUNS_DIR=/var/lib/torch/resolver-runs`

This keeps API + resolver aligned on the same resolver artifact path.

## 5) Recommended Data Contracts

- Betting runs: `YYYY-MM-DD.json`
- Resolver runs: `RESOLVE-*.json`
- Resolver state: single state file (for idempotency/progress)

## 6) Quick Validation Checklist

- `torch-api` can read both `BETTING_RUNS_DIR` and `RESOLVER_RUNS_DIR`
- bot/resolver processes can write to their run dirs
- resolver can write `RESOLVER_STATE_PATH`
- path values in env files match real directories on disk
- permissions are set for the service user (read/write as needed)
