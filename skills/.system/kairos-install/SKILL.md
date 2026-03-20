---
name: kairos-install
description: >-
  KAIROS first-time install with Ollama and kairos-mini. Use when the user
  wants to install KAIROS, set up the minimal stack (Ollama + kairos-mini),
  run KAIROS locally with Ollama embeddings, or get "kairos mini" running.
  Confirm each step with the user before executing.
---

# kairos-install

Guide the user through installing Ollama and running the kairos-mini stack. **Confirm with the user before each step** that changes the system or starts services.

## 1. Goal

Confirm: install Ollama (local embeddings) and run KAIROS minimal stack (Qdrant + app) as **kairos-mini**. If the user only wants one of these, adjust the steps.

## 2. Ollama

- **Check:** Is Ollama already installed and running? (e.g. `ollama list` or open https://ollama.com and check install docs.)
- **If not:** Ask the user to install Ollama from https://ollama.com for their OS, or run the official one-liner if they confirm. Do not install without confirmation.
- **Model:** Confirm pulling the embedding model. Then run:
  ```bash
  ollama pull nomic-embed-text
  ```
  (Confirm before running if the user did not already ask for it.)

## 3. kairos-mini directory

The user needs a directory that contains:
- `compose.yaml` (same as this repo’s root `compose.yaml`, or a copy)
- `.env` with Ollama + minimal settings

**Option A — User has a separate mini directory (e.g. `~/local/ai/kairos-mini`):** Use that. Ensure it has `compose.yaml` and `.env`.

**Option B — From this repo:** Use repo root; `compose.yaml` is there. Create `.env` from `docs/install/env.example.minimal.txt`.

**Confirm with the user** which directory to use and that you may create or overwrite `.env` there.

## 4. .env for Ollama + Docker

If the app will run **in Docker** and Ollama is on the **host**, the container must reach the host. In **.env** set (base URL only; no trailing `/v1`):

```env
OPENAI_API_URL=http://host.docker.internal:11434
OPENAI_EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=ollama
```

If the app runs on the host (e.g. `npm run dev`), use `OPENAI_API_URL=http://localhost:11434` instead.

**Confirm** the path to `.env` and that these values are correct for their setup (Docker vs host).

## 5. Start the stack

From the chosen directory (that has `compose.yaml` and `.env`):

```bash
docker compose -p kairos-mini up -d
```

**Confirm with the user** before running. Remind them that ports 3000 (app) and 6333 (Qdrant) must be free.

## 6. Verify

After starting, suggest:

```bash
curl http://localhost:3000/health
```

If the app fails to start, check logs: `docker compose -p kairos-mini logs app-prod`. Common cause: app in Docker cannot reach Ollama (use `OPENAI_API_URL=http://host.docker.internal:11434` on Mac/Windows).

## Reference

- Full install options and env examples: [docs/install/README.md](../../docs/install/README.md).
- Main README quick start: [README.md](../../README.md).
