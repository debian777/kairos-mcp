# Worked examples and validation

This page keeps extended examples and final checks out of the main skill body.

## Worked examples

Use this flow when the user wants the default local install.

1. Read the GitHub install index, prerequisites, simple stack, and CLI docs.
2. Confirm Docker is present and install the CLI with
   `npm install -g @debian777/kairos-mcp` or use `npx`.
3. Ask which backend to use. If the user chooses OpenAI, confirm the default
   model `text-embedding-3-small`.
4. Confirm the `.env` path, write the OpenAI block with `QDRANT_API_KEY` and
   `AUTH_ENABLED=false`, and ask before overwriting anything.
5. Ask before `docker compose -p kairos-mcp up -d`.
6. Verify `curl -sS "http://localhost:${SERVER_PORT:-3000}/health"`.
7. Explain that no CLI login is needed for the simple stack because
   `AUTH_ENABLED=false`.
8. Offer MCP config only if the user's IDE explicitly needs it.

No-clone flow:

1. Create or choose an empty working directory after user approval.
2. Download `compose.yaml` from
   `https://raw.githubusercontent.com/debian777/kairos-mcp/main/compose.yaml`.
3. Choose the embedding backend before writing `.env`.
4. Create `.env` in that directory, then continue with Compose and health
   checks.

GitHub-fetch fallback flow:

1. Tell the user GitHub fetch failed.
2. Read the matching local file from the repo root, for example
   `docs/install/README.md`.
3. Continue the install from that local fallback.

Auth-enabled target flow:

1. Set or confirm the target server URL.
2. Run `kairos login` or `kairos login --token <bearer-token>`.
3. Validate with `kairos token --validate`.
4. Continue with the intended CLI command or MCP host setup.

Ollama flow:

1. Confirm whether Ollama is already installed.
2. If it is missing, ask whether to install it from `https://ollama.com/download`.
3. Ask whether to pull `nomic-embed-text`.
4. Write the Ollama `.env` block with the correct URL for the host and runtime
   location.
5. Start Compose and verify `/health`.

TEI flow:

1. Confirm the reachable `TEI_BASE_URL`.
2. Ask whether to use the default model `Alibaba-NLP/gte-large-en-v1.5` or a
   user-supplied `TEI_MODEL`.
3. Write the TEI `.env` block.
4. Start Compose and verify `/health`.

GitHub-versus-local mismatch response:

`The GitHub install doc and the local checkout differ for this step. GitHub says X, the local file says Y. Which source should I follow for this install?`

Compose service-key example:

```yaml
services:
  app-prod:
    image: debian777/kairos-mcp
  qdrant:
    image: qdrant/qdrant
```

In that example, the log target is `app-prod`.

## Conversation examples

Use this consultation style when you need the user to choose.

- **Good:** `Docker Compose v2 is missing. Install Docker now? yes/no`
- **Good:** `Choose the embedding backend before we write .env: OpenAI, Ollama, or TEI.`
- **Good:** `Ollama is installed but nomic-embed-text is missing. Pull that model now? yes/no`
- **Good:** `The local simple stack uses AUTH_ENABLED=false, so login is not required. If you want the CLI against a remote auth-enabled server, choose browser login or token login.`

Avoid this behavior during install.

- **Bad:** `I installed Ollama and pulled a model for you.`
- **Bad:** `I picked OpenAI because it is easier.`
- **Bad:** `Let's configure Keycloak as part of the simple install.`
- **Bad:** `I updated .env and started Compose; check if it works.`

## Validation checklist

Before finishing, verify that you:

- used the GitHub install docs directly
- resolved every major decision with the user
- installed nothing without approval
- wrote `.env` only after confirming the path and overwrite safety
- kept simple-stack auth disabled unless the user chose a different deployment
- guided CLI login only when auth is actually enabled
- treated MCP as optional
- re-ran version checks after Docker/npm CLI updates when update mode was used
