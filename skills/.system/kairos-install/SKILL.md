---
name: kairos-install
description: >-
  KAIROS first-time install: user chooses OpenAI or Ollama embeddings, then
  minimal Docker stack (app + Qdrant). Use when the user wants to install
  KAIROS locally, set up compose from this repo, or configure embedding
  backends. Confirm each step with the user before executing.
---

# kairos-install

Guide the user through running the minimal KAIROS stack from this repo
(Qdrant + app). **Confirm with the user before each step** that changes the
system or starts services.

## 1. Goal

Confirm the user wants the **minimal** stack (see [docs/install/README.md](../../../docs/install/README.md)).

**Ask which embedding backend they want:**

- **OpenAI (cloud):** real `OPENAI_API_KEY`; no local Ollama.
- **Ollama (local):** OpenAI-compatible endpoint on the host; typical model
  `nomic-embed-text`.

Follow only the matching section below (§2 or §3), then the shared steps.

## 2. OpenAI (cloud)

- **No Ollama** required for this path.
- Start from `docs/install/env.example.minimal.txt` into `.env`. Set
  `QDRANT_API_KEY` and a valid `OPENAI_API_KEY`. Omit `OPENAI_API_URL` unless
  using a non-default API base (default is `https://api.openai.com`; see repo
  config).
- Optional: `OPENAI_EMBEDDING_MODEL` (default in app:
  `text-embedding-3-small`).
- **Verify key (optional):** After the user confirms, from the repo root with
  `.env` loaded they can run `npm run dev:test-embedding-key` (see install
  docs). Do not run without confirmation.

## 3. Ollama (local)

- **Check:** Is Ollama already installed and running? For example, run
  `ollama list` or check the install docs at https://ollama.com.
- **If not:** Ask the user to install Ollama from https://ollama.com for
  their OS, or run the official one-liner if they confirm. Do not install
  without confirmation.
- **Model:** Confirm pulling the embedding model. Then run:
  ```bash
  ollama pull nomic-embed-text
  ```
  (Confirm before running if the user did not already ask for it.)
- **`.env`:** From `docs/install/env.example.minimal.txt`, set `QDRANT_API_KEY`
  plus the Ollama variables below. Use the **base URL only** (no trailing
  `/v1`).

If the app runs **in Docker Compose** and Ollama is on the **host** on
**Mac or Windows**:

```env
QDRANT_API_KEY=<local-dev-secret>
OPENAI_API_URL=http://host.docker.internal:11434
OPENAI_EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=ollama
```

If the app runs on the host (for example `npm run dev:start`), use
`OPENAI_API_URL=http://localhost:11434` instead.

**Confirm** the `.env` path and whether the app will run in Docker Compose or
on the host before setting `OPENAI_API_URL`.

## 4. Working directory

The user needs a directory that contains:

- `compose.yaml`
- `.env` with minimal settings (embedding variables differ by §2 vs §3 only)

**Default — This repo root:** Use the repo root. `compose.yaml` is already
there. Create `.env` from `docs/install/env.example.minimal.txt`.

**Optional — Separate local directory:** If the user already has a separate
directory with a copy of `compose.yaml`, use that instead.

**Confirm with the user** which directory to use and that you may create or
overwrite `.env` there.

## 5. Start the stack

From the chosen directory (that has `compose.yaml` and `.env`):

```bash
docker compose -p kairos-mcp up -d
```

**Confirm with the user** before running. Remind them that ports 3000 (app),
6333 (Qdrant), and 9090 (metrics) must be free.

## 6. Verify

After starting, suggest:

```bash
curl http://localhost:3000/health
```

If the app fails to start, check logs:
`docker compose -p kairos-mcp logs app-prod`.

- **OpenAI:** embedding or auth errors often mean an invalid or missing
  `OPENAI_API_KEY` (e.g. HTTP 401 from the embeddings API).
- **Ollama:** a common mistake is the app running in Docker while Ollama runs
  on the host and `OPENAI_API_URL` still points at `localhost` instead of
  `http://host.docker.internal:11434` on Mac or Windows.

## Reference

- KAIROS MCP on GitHub: https://github.com/debian777/kairos-mcp
- Issues: https://github.com/debian777/kairos-mcp/issues
- Full install options and env examples:
  [docs/install/README.md](../../../docs/install/README.md).
- Main README quick start: [README.md](../../../README.md).
