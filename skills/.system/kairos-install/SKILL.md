---
name: kairos-install
description: >-
  KAIROS first-time install with Ollama and the minimal Docker stack. Use
  when the user wants to install KAIROS, set up the repo's minimal stack
  (Ollama + app + Qdrant), or run KAIROS locally with Ollama embeddings.
  Confirm each step with the user before executing.
---

# kairos-install

Guide the user through installing Ollama and running the minimal KAIROS stack
from this repo. **Confirm with the user before each step** that changes the
system or starts services.

## 1. Goal

Confirm: install Ollama (local embeddings) and run the minimal KAIROS stack
(Qdrant + app). If the user only wants one of these, adjust the steps.

## 2. Ollama

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

## 3. Working directory

The user needs a directory that contains:
- `compose.yaml`
- `.env` with Ollama + minimal settings

**Default — This repo root:** Use the repo root. `compose.yaml` is already
there. Create `.env` from `docs/install/env.example.minimal.txt`.

**Optional — Separate local directory:** If the user already has a separate
directory with a copy of `compose.yaml`, use that instead.

**Confirm with the user** which directory to use and that you may create or
overwrite `.env` there.

## 4. .env for Ollama + Docker

Start from `docs/install/env.example.minimal.txt`, then ensure `.env` sets
`QDRANT_API_KEY` plus the Ollama values below.

If the app will run **in Docker Compose** and Ollama is on the **host** on
**Mac or Windows**, use the host bridge URL (base URL only; no trailing
`/v1`):

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
`docker compose -p kairos-mcp logs app-prod`. A common cause is the app
running in Docker while Ollama runs on the host and `OPENAI_API_URL` still
points at `localhost` instead of
`http://host.docker.internal:11434` on Mac or Windows.

## Reference

- Full install options and env examples:
  [docs/install/README.md](../../../docs/install/README.md).
- Main README quick start: [README.md](../../../README.md).
