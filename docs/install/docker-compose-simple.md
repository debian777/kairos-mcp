# Docker Compose — simple stack

The default Compose profile starts only the KAIROS application and Qdrant. This
is the recommended installation path for local use and for first-time setup.
It does not provision an identity provider or other auxiliary services.

Choose the [embedding backend](prerequisites.md#embedding-backend) before you
populate `.env`, and do not run `docker compose up` until section 3 is
complete.

## Stack topology

The simple profile runs two containers in Compose. The application then reaches
the selected embedding backend outside Compose.

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
  subgraph ext ["External"]
    openai["OpenAI"]
    ollama["Ollama"]
  end
  subgraph dc ["Compose — default profile"]
    app["KAIROS app"]
    qdrant["Qdrant"]
  end
  app --> qdrant
  app --> openai
  app --> ollama

  classDef embOpenAI fill:#0d6b48,stroke:#0a5a3c,color:#f0f6fc
  classDef embOllama fill:#0e7b6e,stroke:#0a5c52,color:#f0f6fc
  classDef appN fill:#0550ae,stroke:#0969da,color:#f0f6fc
  classDef vector fill:#116329,stroke:#1a7f37,color:#f0f6fc

  class openai embOpenAI
  class ollama embOllama
  class app appN
  class qdrant vector
```

## Installation sequence

Follow these steps in order.

1. Confirm the [prerequisites](prerequisites.md#prerequisites).
2. Choose the [embedding backend](prerequisites.md#embedding-backend).
3. Create the section 3 `.env` file with `QDRANT_API_KEY` plus the variables
   for the backend you selected.
4. Start the stack and verify `/health`.
5. Use the [CLI](../CLI.md). Configure `mcp.json` only if a host needs MCP over
   HTTP.

## 3. Environment file

Create `.env` next to `compose.yaml`. Set `AUTH_ENABLED=false`, then choose one
embedding block.

### OpenAI

Use this block when your embedding backend is OpenAI.

```ini
OPENAI_API_KEY=sk-proj-xxxxxxxx
QDRANT_API_KEY=change-me
AUTH_ENABLED=false
```

### Ollama (Compose app + Ollama on host; no `/v1` in URL)

Use this block when the application runs in Compose and Ollama runs on the
host.

```ini
OPENAI_API_URL=http://host.docker.internal:11434
OPENAI_EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=ollama
QDRANT_API_KEY=change-me
AUTH_ENABLED=false
```

App on **host** (not container): `OPENAI_API_URL=http://127.0.0.1:11434`

### Ports to free

| Service | Port |
|---------|------|
| App | `SERVER_PORT` → 3000 |
| Qdrant | 6333, 6344 |
| Metrics | `METRICS_PORT` → 9090 |

## 4. Start

Start the default profile, then confirm that the application answers on its
health endpoint.

```sh
docker compose -p kairos-mcp up -d
curl -sS "http://localhost:${SERVER_PORT:-3000}/health"
```

Use `kairos --url ...` for checks and operations once the
[CLI](../CLI.md) is installed.

| Path | URL pattern |
|------|-------------|
| UI | `http://localhost:3000/ui` |
| MCP | `http://localhost:3000/mcp` |
| Metrics | `http://localhost:9090/metrics` |

## 5. MCP client (`mcp.json`)

Configure this only when an IDE or host needs MCP over HTTP. Match **`SERVER_PORT`**, and
use the CLI for authentication and operational checks.

```json
{
  "mcpServers": {
    "KAIROS": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "alwaysAllow": [
        "activate",
        "forward",
        "train",
        "reward",
        "tune",
        "delete",
        "export",
        "spaces"
      ]
    }
  }
}
```

## Services (default profile)

The default profile starts these containers:

- `qdrant`
- `app-prod` (`debian777/kairos-mcp` image from `compose.yaml`)

## Related

Use these pages when you need adjacent topics.

- [Full stack (advanced)](docker-compose-full-stack.md) — additional services
  for operator-managed deployments

## Troubleshooting

Use these checks when the stack does not start as expected.

| Issue | Fix |
|-------|-----|
| `QDRANT_API_KEY must be set` | Add it to `.env`, then start the stack again |
| Port in use | Change **`SERVER_PORT`** or `METRICS_PORT`, or stop the conflicting process |
| App unhealthy | Run `docker compose -p kairos-mcp logs app-prod` |
| Embedding errors | Re-check the [embedding backend](prerequisites.md#embedding-backend), then test with `kairos` and server logs |
