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

### Optional — Ollama (local embeddings)

Use [Ollama](https://ollama.com) with an OpenAI-compatible embeddings endpoint (e.g. `nomic-embed-text`). KAIROS only needs the **base** URL; it appends `/v1/embeddings` itself — do **not** put `/v1` in `OPENAI_API_URL` or you get a double path.

| App runs on | `OPENAI_API_URL` |
|-------------|-------------------|
| Host (e.g. `npm run dev`) | `http://localhost:11434` |
| Docker, Ollama on host (Mac/Windows) | `http://host.docker.internal:11434` |

In `.env`: set `OPENAI_EMBEDDING_MODEL=nomic-embed-text` and `OPENAI_API_KEY=ollama` (Ollama does not validate the key). Ensure Ollama is running and the model is pulled: `ollama pull nomic-embed-text`.

**Note:** Switching to or from Ollama changes embedding dimension (e.g. 1536 → 768). On first start the app will migrate the Qdrant collection (recreate vectors, re-embed if there was existing data). Empty collections migrate quickly.

See commented lines in `env.example.minimal.txt`.

| File | Use case |
|------|----------|
| **env.example.minimal.txt** | App + Qdrant only (minimal; no Redis, no auth, no Keycloak). |
| **env.example.fullstack.txt** | Full Docker stack: Redis, Qdrant, Postgres, Keycloak, auth enabled. Use for local full stack and CI. |

- **Quick start (minimal, default):** `cp env.example.minimal.txt .env`, set `OPENAI_API_KEY` (or TEI), then `docker compose -p kairos-mcp up -d`.
- **Full stack (Redis, Keycloak):** `cp env.example.fullstack.txt .env`, set secrets and `REDIS_URL=redis://redis:6379`, then `docker compose -p kairos-mcp --profile fullstack up -d`.
- **CI / generate script:** Uses `scripts/env/.env.template` (fullstack). Run `python3 scripts/generate_dev_secrets.py` to produce `.env`.

For **Google sign-in in dev**, see [Google auth (dev)](google-auth-dev.md).
