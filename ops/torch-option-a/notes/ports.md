# Ports (Option A)

| Port | Service        | Notes                                      |
|------|----------------|--------------------------------------------|
| 8000 | Subgraph       | Already in use: GraphQL at http://65.108.254.251:8000/subgraphs/name/TorchPredictionMarket |
| 3001 | Torch read-only API | torch-api listens here; no DNS — use http://65.108.254.251:3001 |

Ensure firewall allows 3001 if the dashboard (Vercel) calls the API from the internet. Token is required on every request.
