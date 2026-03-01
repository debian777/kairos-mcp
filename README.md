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

## Quick start

**Dev (memory + Qdrant with app)**

```bash
git clone https://github.com/debian777/kairos-mcp.git
cd kairos-mcp
npm ci
node scripts/generate_dev_secrets.mjs   # creates .env (all enabled)
# Or copy env.example.txt to .env and set OPENAI_API_KEY etc.
npm run build     # needed for CLI tests
npm test          # AUTH_ENABLED=false REDIS_URL= overrides → memory backend, no auth
npm run dev       # starts Qdrant if needed, then hot-reload; npm run stop stops app + Qdrant
```

**Integration tests (full stack: infra up → test → down)**

```bash
node scripts/generate_dev_secrets.mjs   # single .env, all enabled
npm run build
npm run test:integration   # starts Redis, Qdrant, Postgres, Keycloak → runs tests → shuts down
```

**Run app with full infra (Redis, Keycloak) manually**

```bash
node scripts/generate_dev_secrets.mjs
npm run infra:up   # start Redis, Qdrant, Postgres, Keycloak
npm start          # starts Qdrant if needed, then app (AUTH_ENABLED=true)
npm run stop       # stop app and Qdrant (profile app); use infra:down to stop full stack
```

Access the server at `http://localhost:3300` (or `PORT` from `.env`); health check at `http://localhost:3300/healthz`.

Full developer workflow (lint, build, test, validate) is in [CONTRIBUTING.md](CONTRIBUTING.md).

**Single .env:** One file with all enabled. `npm start` / `npm run dev` bring up Qdrant (Docker profile `app`) automatically. `npm run stop` stops the app and brings down Qdrant. `npm run test:integration` starts full infra, runs the test suite, then shuts infra down.

## What you get

- **Persistent memory** — Store and retrieve protocol chains in Qdrant; update and mint via tools.
- **Deterministic execution** — Search → begin → next (loop) → attest; server drives `next_action`.
- **Agent-facing design** — Tool descriptions, schemas, and errors built for programmatic consumption and recovery.
- **Redis + Qdrant** — Proof-of-work state and vector store; optional Docker Compose for infra or full stack. For dev or simple setups without Redis, leave `REDIS_URL` unset or empty to use an in-memory backend (see [env.example.txt](env.example.txt)).

## Contributing

Contributions are welcome. Developer setup, npm commands (lint, build, test, start, dev, validate), and guidelines are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/README.md)
- 📐 [Agent-facing design principles](CONTRIBUTING.md#agent-facing-design-principles)
  — for contributors designing or reviewing MCP tools and APIs
- 🐛 [Issue Tracker](https://github.com/debian777/kairos-mcp/issues)
- 💬 [Discussions](https://github.com/debian777/kairos-mcp/discussions)
