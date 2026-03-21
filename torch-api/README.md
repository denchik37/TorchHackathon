# Torch API

Token-protected read-only HTTP API that serves run artifacts from the bet bot and oracle resolver. Intended to run on Hetzner; dashboard on Vercel proxies to it server-side (token never in browser).

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Default `3001`. |
| `DASHBOARD_API_TOKEN` | Yes | Bearer token; must match dashboard server env. |
| `BETTING_RUNS_DIR` | Yes | Absolute path to `torch-agent-kit-bot/runs` (or equivalent). |
| `RESOLVER_RUNS_DIR` | Yes | Absolute path to `torch-oracle-resolver/runs`. |

## Example curl

```bash
curl http://YOUR_HETZNER_IP:3001/api/health -H "Authorization: Bearer YOUR_TOKEN"
```

## Endpoints (all GET, all require `Authorization: Bearer <token>`)

- `GET /api/health` — `{ nowUtc, lastBettingRun, lastResolverRun }`
- `GET /api/betting/runs` — array of betting run summaries
- `GET /api/betting/runs/:date` — full artifact for `YYYY-MM-DD`
- `GET /api/resolver/runs` — `{ runs: [{ id, filename, timestampUtc, mode, acceptedCount?, blockedCount? }] }`
- `GET /api/resolver/runs/:id` — full resolver run JSON

## Notes

- No secrets are ever returned in responses.
- List/health use `Cache-Control: public, max-age=10`; detail endpoints use `max-age=30`.
