# Install and environment

Copy one of the env examples below to `.env` in the project root, then edit as needed.

## OpenAI API key (restricted / embeddings-only)

KAIROS only needs **Embeddings** (`/v1/embeddings`) access. You can create a restricted key in the [OpenAI API Keys](https://platform.openai.com/api-keys) UI.

**UI workaround:** The permissions UI has a quirk. Setting only **Embeddings** to **Request** can yield `401 Missing scopes: model.request`. To get an embeddings-only key that works:

1. Create a new secret key and choose **Restricted**.
2. Set the **Model capabilities** group to **Request** first (so the `model.request` scope is granted).
3. Then set every *individual* capability under Model capabilities to **None**, except **Embeddings (/v1/embeddings)** — leave that as **Request**.
4. Leave **List models**, **Assistants**, and all other top-level items as **None**.

Result: **Model capabilities** shows **Mixed**; only Embeddings has Request. The key will work for embeddings and not for chat, images, etc.

![OpenAI key: embeddings-only permissions](openai-key-embeddings-only.png)

To verify the key locally: `npm run dev:test-embedding-key` (or `OPENAI_API_KEY=sk-... node scripts/test-embedding-key.mjs`).

| File | Use case |
|------|----------|
| **env.example.minimal.txt** | App + Qdrant only (minimal; no Redis, no auth, no Keycloak). |
| **env.example.fullstack.txt** | Full Docker stack: Redis, Qdrant, Postgres, Keycloak, auth enabled. Use for local full stack and CI. |
| **env.example.full.txt** | All available options (reference). Copy and trim to your needs. |

- **Quick start (minimal, default):** `cp env.example.minimal.txt .env`, set `OPENAI_API_KEY` (or TEI), then `docker compose -p kairos-mcp up -d`.
- **Full stack (Redis, Keycloak):** `cp env.example.fullstack.txt .env`, set secrets and `REDIS_URL=redis://redis:6379`, then `docker compose -p kairos-mcp --profile fullstack up -d`.
- **CI / generate script:** Uses `scripts/env/.env.template` (fullstack). Run `python3 scripts/generate_dev_secrets.py` to produce `.env`.

If the CLI auth E2E test fails, check `reports/` for `e2e-cli-auth-failure-*.png` and `*.html` to see what Keycloak rendered.

For **Google sign-in in dev**, see [Google auth (dev)](google-auth-dev.md).
