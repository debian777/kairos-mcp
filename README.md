# KAIROS MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org/)

AI agents need durable memory and repeatable execution. KAIROS MCP gives them persistent knowledge and a deterministic protocol loop that integrates into real tools.

## Mission

Make agent work durable and executable by providing:

- **Persistent memory** across sessions (store, retrieve, update, delete)
- **Deterministic protocol execution** (search → begin → next → attest)
- **Agent-facing interfaces** that teach correct usage and recover from errors

## Goals

KAIROS MCP wins by being the most reliable "memory + protocol" substrate that agent hosts can depend on. We focus on a small set of primitives that compose into many workflows, schemas and error messages that minimize agent confusion, and backends that orchestrate complexity so the agent-facing surface stays simple.

**Success** means new clients can implement the tool flow without guesswork; execution is repeatable and traceable; and the system can evolve without breaking agents or requiring hidden tribal knowledge.

## Non-goals

KAIROS MCP does not try to be: a general-purpose agent framework or planner; a vector DB or database abstraction; a UI product for humans (agents are the primary users); or a place to store secrets, credentials, or regulated personal data.

## Quick start (Docker)

**Option A — Full stack (recommended):** Run the complete stack with Docker Compose (Redis, Qdrant, MCP server).

```bash
git clone https://github.com/debian777/kairos-mcp.git
cd kairos-mcp
cp env.example.txt .env.prod
# Edit .env.prod (secrets, Keycloak; see env.example.txt)
docker compose -p kairos-mcp --profile prod up -d
# For infra-only (Redis, Qdrant, Keycloak): docker compose -p kairos-mcp --env-file .env.prod --profile infra up -d
```

Access the server at `http://localhost:3000`; health check at `http://localhost:3000/health`.

**Option B — Developer:** Infra via Docker, app via Node (for local development).

```bash
git clone https://github.com/debian777/kairos-mcp.git
cd kairos-mcp
npm ci
cp env.example.txt .env.dev
# Configure .env.dev (see env.example.txt)
npm run infra:up
npm run dev:start
```

Full developer workflow (build, test, lint, dev/qa commands) is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## What you get

- **Persistent memory** — Store and retrieve protocol chains in Qdrant; update and mint via tools.
- **Deterministic execution** — Search → begin → next (loop) → attest; server drives `next_action`.
- **Agent-facing design** — Tool descriptions, schemas, and errors built for programmatic consumption and recovery.
- **Redis + Qdrant** — Proof-of-work state and vector store; optional Docker Compose for infra or full stack.

## Contributing

Contributions are welcome. Developer setup, all npm commands (build, deploy, test, dev/qa, lint, infra, Docker), and contribution guidelines are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/README.md)
- 📐 [Agent-facing design principles](CONTRIBUTING.md#agent-facing-design-principles)
  — for contributors designing or reviewing MCP tools and APIs
- 🐛 [Issue Tracker](https://github.com/debian777/kairos-mcp/issues)
- 💬 [Discussions](https://github.com/debian777/kairos-mcp/discussions)
