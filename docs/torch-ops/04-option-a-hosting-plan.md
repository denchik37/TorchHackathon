# Option A: Hosting Plan (Hetzner read-only API + Vercel dashboard)

## Option A in one sentence

**Hetzner** runs the bet bot, oracle resolver, and a **read-only HTTP API** that serves run artifacts and health. **Vercel** hosts the dashboard (and/or main Torch app), which calls this API with a bearer token. No secrets on Vercel; no write operations from the dashboard.

---

## API design

Base URL: e.g. `https://torch-api.example.com`. All endpoints require:

```http
Authorization: Bearer <DASHBOARD_API_TOKEN>
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/betting/runs` | GET | List betting run summaries (one per calendar day from `runs/YYYY-MM-DD.json`). |
| `/api/betting/runs/:date` | GET | Full betting run artifact for `:date` (YYYY-MM-DD). |
| `/api/resolver/runs` | GET | List resolver run artifacts (from `torch-oracle-resolver/runs/`). |
| `/api/resolver/runs/:id` | GET | Full resolver run artifact for `:id` (runId, e.g. RESOLVE-2025-03-10T14-00-00). |
| `/api/health` | GET | Summary: last betting run, next target, last resolver run (and optionally errors). |

Optional:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account` | GET | Bot account id, network, balance (from Mirror). No private key or sensitive data. |

- **Port**: e.g. one Node process listening on 3000 (or 4000); nginx in front as reverse proxy and TLS.
- **Paths**: Implementations read from bot `runs/` and resolver `runs/` (and resolver `state.json` if needed for health). Paths are configurable via env (e.g. `BETTING_RUNS_DIR`, `RESOLVER_RUNS_DIR`).

---

## Security

- **Bearer token**: Every request must send `Authorization: Bearer DASHBOARD_API_TOKEN`. API returns 401 if missing or wrong.
- **Rate limiting**: At nginx (or in app): e.g. 60 req/min per IP (or per token) to avoid abuse.
- **No secrets in responses**: Responses contain only run metadata, artifact JSON, and public account/balance data. No `PRIVATE_KEY`, `OPENAI_API_KEY`, or `ADMIN_PRIVATE_KEY` ever returned.
- **HTTPS only**: nginx terminates TLS; internal app can listen on localhost.

---

## Deployment topology

```
                    Internet
                        |
                        v
                 [ nginx :443 ]
                 TLS, rate limit
                 proxy to :3000
                        |
                        v
              [ Node read-only API :3000 ]
              reads BETTING_RUNS_DIR
              reads RESOLVER_RUNS_DIR
                        |
         +--------------+--------------+
         |              |              |
         v              v              v
   bot runs/    resolver runs/   (optional)
   YYYY-MM-DD   RESOLVE-*.json   state.json
   .json
```

- **Bot** and **resolver** run as separate processes (systemd services/timers); they **write** to their `runs/` dirs.
- **Read-only API** is a separate Node (or Next.js) app that only **reads** those dirs and returns JSON. It does not execute bets or resolver logic.
- **Vercel** dashboard sets `NEXT_PUBLIC_BETTING_API_BASE` (or `NEXT_PUBLIC_API_BASE`) and a server-side or build-time `DASHBOARD_API_TOKEN` (or pass token via server-side fetch only, never in client bundle).

---

## Env vars for the read-only API (Hetzner)

| Variable | Description |
|----------|-------------|
| `DASHBOARD_API_TOKEN` | Secret token; must match what Vercel sends in `Authorization: Bearer`. |
| `BETTING_RUNS_DIR` | Absolute path to bot `runs/` (e.g. `/opt/torch-agent-kit-bot/runs`). |
| `RESOLVER_RUNS_DIR` | Absolute path to resolver `runs/` (e.g. `/opt/torch-oracle-resolver/runs`). |
| `PORT` | Port the API listens on (e.g. 3000). |
| (Optional) `ACCOUNT_ID`, `NETWORK` | For `/api/account` to fetch Mirror data. |

---

## Ports and endpoints summary

| Service | Port (example) | Notes |
|---------|----------------|-------|
| nginx | 443 (HTTPS), 80 → 443 | TLS; reverse proxy to API. |
| Read-only API | 3000 (internal) | Only reachable via nginx from outside. |
| Subgraph | (existing) | Already on Hetzner; API does not need to expose it. |
