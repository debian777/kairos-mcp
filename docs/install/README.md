# Install and environment

Copy one of the env examples below to `.env` in the project root, then edit as needed.

| File | Use case |
|------|----------|
| **env.example.minimal.txt** | App + Qdrant only (minimal; no Redis, no auth, no Keycloak). |
| **env.example.fullstack.txt** | Full Docker stack: Redis, Qdrant, Postgres, Keycloak, auth enabled. Use for local full stack and CI. |
| **env.example.full.txt** | All available options (reference). Copy and trim to your needs. |

- **Quick start (minimal, default):** `cp env.example.minimal.txt .env`, set `OPENAI_API_KEY` (or TEI), then `docker compose -p kairos-mcp up -d`.
- **Full stack (Redis, Keycloak):** `cp env.example.fullstack.txt .env`, set secrets and `REDIS_URL=redis://redis:6379`, then `docker compose -p kairos-mcp --profile fullstack up -d`.
- **CI / generate script:** Uses `scripts/env/.env.template` (fullstack). Run `python3 scripts/generate_dev_secrets.py` to produce `.env`.
