# Install and environment

KAIROS reads all runtime configuration from environment variables. For local
work, copy one of the provided examples to `.env` at the repository root and
edit only the values you need.

## Choose an env example

| File | Use case |
|------|----------|
| `docs/install/env.example.minimal.txt` | Minimal Docker deployment: app + Qdrant only, `AUTH_ENABLED=false` |
| `docs/install/env.example.fullstack.txt` | Local full stack: Redis, Postgres, Keycloak, auth enabled |
| `scripts/env/.env.template` | Template used by `scripts/generate_dev_secrets.py` for dev/CI-style fullstack `.env` generation |

## Minimal setup

Use this when you want the default Docker stack from `compose.yaml`.

```bash
cp docs/install/env.example.minimal.txt .env
docker compose -p kairos-mcp up -d
```

Set at least:

- `QDRANT_API_KEY`
- one embedding backend:
  - `OPENAI_API_KEY`, or
  - `OPENAI_API_URL` + `OPENAI_EMBEDDING_MODEL` + `OPENAI_API_KEY=ollama`, or
  - `TEI_BASE_URL` (+ optional `TEI_MODEL`)

The minimal example pins `AUTH_ENABLED=false`, so the app starts without
Keycloak or session/Bearer auth.

## Fullstack setup

Use this when you want Redis, Postgres, Keycloak, and auth enabled locally.

```bash
cp docs/install/env.example.fullstack.txt .env
docker compose -p kairos-mcp --profile fullstack up -d
```

Set these before starting:

- `QDRANT_API_KEY`
- `REDIS_PASSWORD`
- `SESSION_SECRET`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_DB_PASSWORD`
- an embedding backend (`OPENAI_API_KEY` or TEI settings)

### `REDIS_URL` depends on where the app runs

If the app runs **inside Docker Compose**, use the Redis service hostname:

```env
REDIS_URL=redis://:your-password@redis:6379
```

If the app runs **on the host** (for example `npm run dev:start`), use the
host-mapped port:

```env
REDIS_URL=redis://:your-password@127.0.0.1:6379
```

## Embedding backends

### OpenAI

KAIROS uses the embeddings API only. A restricted API key is sufficient if it
is allowed to call `/v1/embeddings`.

To verify the key locally:

```bash
npm run dev:test-embedding-key
```

### Ollama / OpenAI-compatible local endpoint

KAIROS expects the **base URL** only. Do not include `/v1`; the server appends
`/v1/embeddings` itself.

| App location | `OPENAI_API_URL` |
|--------------|------------------|
| app on host | `http://localhost:11434` |
| app in Docker, Ollama on host (Mac/Windows) | `http://host.docker.internal:11434` |

Typical Ollama settings:

```env
OPENAI_API_URL=http://localhost:11434
OPENAI_EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=ollama
```

You must have Ollama running and the model pulled:

```bash
ollama pull nomic-embed-text
```

Switching embedding backends can change vector dimension. On the next start,
the server may migrate the Qdrant collection to the current vector layout.

### TEI

If you are using a TEI-compatible endpoint, set:

```env
TEI_BASE_URL=http://your-tei-host:8080
TEI_MODEL=Alibaba-NLP/gte-large-en-v1.5
```

`TEI_MODEL` is optional if the server default is acceptable.

## Generated dev secrets

To create a fullstack-style `.env` with generated secrets:

```bash
python3 scripts/generate_dev_secrets.py
```

That script writes `.env` using `scripts/env/.env.template`.

## Common env variables

These are the most important runtime settings documented by `src/config.ts`:

| Variable | Meaning |
|----------|---------|
| `PORT` | Main HTTP server port |
| `METRICS_PORT` | Separate metrics server port |
| `QDRANT_URL` | Qdrant base URL |
| `QDRANT_API_KEY` | Qdrant API key |
| `QDRANT_COLLECTION` | Default collection name when no current alias override is set |
| `REDIS_URL` | Enables Redis-backed cache / proof-of-work state when non-empty |
| `AUTH_ENABLED` | Enables auth enforcement for `/api`, `/mcp`, and `/ui` |
| `KEYCLOAK_URL` | Public Keycloak base URL used for browser-facing auth flows |
| `KEYCLOAK_INTERNAL_URL` | Optional internal Keycloak URL for server-side token exchange |
| `AUTH_CALLBACK_BASE_URL` | Base URL used to build `/auth/callback` |

For Google sign-in setup in the dev realm, see
[Google sign-in (dev)](google-auth-dev.md).
