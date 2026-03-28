# KAIROS MCP

<img src="logo/kaiiros-mcp.svg" width="128" alt="KAIROS MCP logo" />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D25.0.0-brightgreen)](https://nodejs.org/)

KAIROS MCP is a TypeScript service for storing and executing reusable protocol
chains for AI agents. It exposes:

- an MCP endpoint at `POST /mcp`
- REST endpoints under `/api/*`
- a browser UI under `/ui`
- a CLI named `kairos`

Without persistent workflows, agents repeat work, lose context, and cannot
follow multi-step procedures reliably. KAIROS fixes this with three core
ideas (the diagrams below list every **MCP tool**):

- **Persistent memory** — store and retrieve protocol chains across sessions
- **Deterministic execution** — **activate** → **forward** (per layer) →
  **reward**; the server drives `next_action` at every step
- **Agent-facing design** — tool descriptions and error messages built for
  programmatic consumption and recovery

Protocol execution runs in a fixed order: **activate** (match adapters),
**forward** (run each layer’s contract; loop), then **reward** (finalize the
run). Use **train** / **tune** / **export** / **delete** / **spaces** as
described in each tool’s MCP description.

**Default run order** — `activate` → `forward` (loop per layer) → `reward`:

```mermaid
flowchart LR
  A([activate]) --> B([forward])
  B -.-> B
  B --> D([reward])
  style A fill:#4a6fa5,stroke:#2d4a7a,color:#fff
  style B fill:#ffb74d,stroke:#f57c00,color:#333
  style D fill:#81c784,stroke:#388e3c,color:#333
```

**Discovery and adapter lifecycle** — no fixed order; follow each tool’s MCP description:

```mermaid
flowchart LR
  S([spaces]) --- TR([train]) --- TU([tune]) --- EX([export]) --- DL([delete])
  style S fill:#4a6fa5,stroke:#2d4a7a,color:#fff
  style TR fill:#ede7f6,stroke:#5e35b1,color:#333
  style TU fill:#fff3e0,stroke:#f57c00,color:#333
  style EX fill:#e8f5e9,stroke:#388e3c,color:#333
  style DL fill:#ffebee,stroke:#c62828,color:#333
```

The server generates challenge data (`nonce`, `proof_hash`, URIs); agents echo
those values back exactly.

## Protocol execution

Authoritative behavior for agents is defined in the MCP tool resources under
[`src/embed-docs/tools/`](src/embed-docs/tools/) (**`activate`**, **`forward`**,
**`reward`**). This is an on-wire summary; follow each response’s `next_action`
and `must_obey` fields in real runs.

1. **`activate`** — Pass the user message or a short intent phrase as `query`.
   From `choices`, pick **one** row and obey **that** row’s `next_action` (do not
   mix in another URI). Typical roles: **`match`** (continue with **`forward`**
   on the given adapter URI), **`refine`**, **`create`** (mint via **`train`**).

2. **`forward`** — With the adapter URI from **`activate`**, call **`forward`**
   and **omit** `solution` on the **first** call for that run. Read `contract`
   and `next_action`. For each layer, call **`forward`** again using the **layer**
   URI from the last response (add `?execution_id=...` when the server returns
   it) and supply a `solution` whose `type` matches `contract.type`. Loop until
   `next_action` tells you to call **`reward`**.

3. **`reward`** — After the last layer, call **`reward`** with the **layer** URI
   from **`forward`** (not the adapter URI unless the schema explicitly allows
   it), `outcome` (`success` or `failure`), and optional evaluator fields per the
   tool description.

**Must always:** Obey `next_action` verbatim. Echo server-issued `nonce`,
`proof_hash`, and URIs exactly.

**Must never:** Invent URIs; skip layers; submit a solution whose type does not
match `contract.type`.

For a longer narrative, see
[docs/architecture/workflow-full-execution.md](docs/architecture/workflow-full-execution.md).

## What runs in this repository

The current codebase includes:

- **HTTP application server** — Express app for MCP, REST, auth routes, and UI
- **Qdrant-backed protocol store** — required for runtime
- **Optional Redis cache / proof-of-work state store** — enabled when `REDIS_URL` is set
- **Optional Keycloak auth integration** — browser session + Bearer JWT validation
- **React UI** — served from the same origin at `/ui`
- **CLI** — talks to the HTTP API

## Quick start

If your agent supports installable skills, start with the guided setup below.
If not, use the manual Docker path that follows.

### Guided setup with the `kairos-install` skill

Use this when you want a guided first-time setup for Ollama, `.env`
configuration, and the minimal local stack.
The repo stores `kairos-install` under `skills/.system/`, but you still
install it by name.

1. Install the setup skill:

   ```bash
   npx skills add debian777/kairos-mcp --skill kairos-install
   ```

2. Ask your agent to run `kairos-install` for this repo. The skill confirms
   each system-changing step before it installs Ollama, prepares `.env`, and
   starts the minimal Docker stack.

3. Verify the server:

   ```bash
   curl http://localhost:3000/health
   ```

4. Open the UI or MCP endpoint:
   - UI: `http://localhost:3000/ui`
   - MCP: `http://localhost:3000/mcp`
   - Metrics: `http://localhost:9090/metrics`

### Manual minimal Docker stack

Use this when you want the smallest working server deployment without the
guided skill. The default Compose profile starts **Qdrant + app only**.

1. Copy the minimal env example:

   ```bash
   cp docs/install/env.example.minimal.txt .env
   ```

2. Edit `.env` and set at least:
   - `QDRANT_API_KEY`
   - one embedding provider:
     - `OPENAI_API_KEY`, or
     - `OPENAI_API_URL` + `OPENAI_EMBEDDING_MODEL` + `OPENAI_API_KEY=ollama`, or
     - `TEI_BASE_URL` (+ optional `TEI_MODEL`)

3. Start the stack:

   ```bash
   docker compose -p kairos-mcp up -d
   ```

4. Verify the server:

   ```bash
   curl http://localhost:3000/health
   ```

5. Open the UI or MCP endpoint:
   - UI: `http://localhost:3000/ui`
   - MCP: `http://localhost:3000/mcp`
   - Metrics: `http://localhost:9090/metrics`

### Full stack (Redis + Postgres + Keycloak)

For local auth-enabled development, copy the fullstack env example and start
the `fullstack` profile:

```bash
cp docs/install/env.example.fullstack.txt .env
docker compose -p kairos-mcp --profile fullstack up -d
```

If you want the repo’s full local development flow, use the documented scripts:

```bash
npm ci
npm run infra:up
npm run dev:deploy
```

The dev scripts default the app to port **3300** (see `scripts/env/.env.template` and
`scripts/run-env.sh`). The Docker minimal stack above defaults **3000** unless you
set `PORT` in `.env`. Use the same host and port in health checks, the UI, and MCP
URLs.

See [docs/install/README.md](docs/install/README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) for the exact env variables and dev workflow.

### Cursor MCP (`DEVELOPMENT_KAIROS`)

This repository ships [`.cursor/mcp.json`](.cursor/mcp.json) with a **streamable
HTTP** entry keyed **`DEVELOPMENT_KAIROS`**, aimed at local MCP on
`http://localhost:3300/mcp` (match **`npm run dev:deploy`** when `PORT=3300`).
If you run the minimal Compose stack without overriding `PORT`, point MCP at
`http://localhost:3000/mcp` instead. Cursor may show a longer **agent-visible**
server id (for example one ending in `-DEVELOPMENT_KAIROS`); see
[AGENTS.md](AGENTS.md) and [docs/INSTALL-MCP.md](docs/INSTALL-MCP.md).

When executing over MCP, follow **[Protocol execution](#protocol-execution)**
above and each tool result’s `next_action`. The connected server’s tool
descriptions are the runtime authority if they differ from this file.

## Installation options

### Run the server with Docker Compose

Use the Compose quick start above. This repository ships `compose.yaml`,
minimal and fullstack env examples, and the scripts used for local development
and CI.

### Install the CLI

Node.js 25 or later is required.

Run once without installing globally:

```bash
npx @debian777/kairos-mcp --help
```

Or install globally:

```bash
npm install -g @debian777/kairos-mcp
kairos --help
```

The CLI talks to a running KAIROS server over HTTP. See [docs/CLI.md](docs/CLI.md).

### Add KAIROS to your agent instructions

This repo ships the **kairos** skill for running protocols. Use `--list`
to see what the skills registry reports for this repo.

If you want agents to use KAIROS consistently, add a short repo rule or
instruction such as:

> KAIROS MCP is a Model Context Protocol server for persistent memory and
> deterministic adapter execution. Execute protocols in this order:
> **`activate`** → **`forward`** (loop per layer until `next_action` points to
> **`reward`**) → **`reward`**. Echo all server-generated hashes, nonces, and
> URIs exactly.

## Agent skills shipped in this repo

This repository currently ships three installable skills. The primary
workflow skill lives in `skills/`. The helper skills live in
`skills/.system/`, but you still install them by name.

| Skill | Purpose |
|-------|---------|
| `kairos` | Run KAIROS protocols |
| `kairos-bug-report` | Capture structured MCP bug reports in `reports/` |
| `kairos-install` | First-time local setup guidance |

Install all shipped skills:

```bash
npx skills add debian777/kairos-mcp
```

Install one specific skill:

```bash
npx skills add debian777/kairos-mcp --skill kairos
```

List available skills:

```bash
npx skills add debian777/kairos-mcp --list
```

Popular global installs:

| Agents | Command |
|--------|---------|
| Cursor | `npx skills add debian777/kairos-mcp -y -g -a cursor` |
| Claude Code | `npx skills add debian777/kairos-mcp -y -g -a claude-code` |
| Cursor + Claude Code | `npx skills add debian777/kairos-mcp -y -g -a cursor -a claude-code` |
| All detected agents | `npx skills add debian777/kairos-mcp -y -g` |

More detail: [skills/README.md](skills/README.md)

## Documentation map

- [Documentation index](docs/README.md)
- [Install and environment](docs/install/README.md)
- [Install KAIROS MCP in Cursor](docs/INSTALL-MCP.md)
- [CLI reference](docs/CLI.md)
- [Architecture](docs/architecture/README.md)
- [Protocol examples](docs/examples/README.md)
- [Contributing](CONTRIBUTING.md)

## Troubleshooting

### The server does not start

Check container logs:

```bash
docker compose -p kairos-mcp logs app-prod
```

Also verify that required ports are free:

- minimal stack: app `3000` (or your `PORT`), Qdrant `6333`, metrics `9090` (or
  your `METRICS_PORT`)
- repo dev scripts: app often `3300`, metrics often `9390` (see `.env`)
- full stack adds: `6379`, `5432`, `8080`, `9000`

### Health check returns `503`

KAIROS only reports healthy when Qdrant is ready. Wait for Qdrant to finish
starting, then retry:

```bash
curl http://localhost:3000/health
```

### Embeddings fail on startup

Set one working embedding backend in `.env`:

- OpenAI: `OPENAI_API_KEY`
- Ollama/OpenAI-compatible: `OPENAI_API_URL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_API_KEY=ollama`
- TEI: `TEI_BASE_URL` (+ optional `TEI_MODEL`)

### Auth-enabled development is failing

Use the fullstack env example, start the `fullstack` profile, and configure
realms:

```bash
npm run infra:up
```

### The CLI keeps asking for login

The CLI stores tokens per API URL. Confirm that:

- you are using the expected `--url` / `KAIROS_API_URL`
- the token is still valid
- Keycloak and the KAIROS server agree on issuer and audience

Use:

```bash
kairos token --validate
```

## Support

- [Documentation](docs/README.md)
- [Issues](https://github.com/debian777/kairos-mcp/issues)
- [Discussions](https://github.com/debian777/kairos-mcp/discussions)

## Trademark

KAIROS MCP™ and the KAIROS MCP logo are trademarks of the project owner.
They are not covered by the MIT license. Forks must remove the name and logo.

See [TRADEMARK.md](TRADEMARK.md).

## License

MIT — see [LICENSE](LICENSE).