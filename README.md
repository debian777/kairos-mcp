# KAIROS MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org/)

KAIROS MCP gives AI agents persistent memory and deterministic protocol
execution. Agents store, retrieve, and run reusable protocol chains across
sessions — without losing context between runs.

## Why KAIROS

Without persistent memory, agents repeat work, lose context, and cannot
follow multi-step procedures reliably. KAIROS fixes this with three
primitives:

- **Persistent memory** — store and retrieve protocol chains across sessions
- **Deterministic execution** — search → begin → next → attest; the server
  drives `next_action` at every step
- **Agent-facing design** — tool descriptions and error messages built for
  programmatic consumption and recovery

## Quick start

KAIROS runs as a Docker stack. Docker and Docker Compose are required.

1. Download the Compose file and environment template:

   ```bash
   curl -LO https://raw.githubusercontent.com/debian777/kairos-mcp/main/compose.yaml
   curl -LO https://raw.githubusercontent.com/debian777/kairos-mcp/main/env.example.txt
   cp env.example.txt .env
   cp env.example.txt .env.prod
   ```

2. Open `.env.prod` and set your embedding provider. For OpenAI:

   ```bash
   OPENAI_API_KEY=sk-proj-...
   ```

3. Start the infrastructure (Redis, Qdrant, Postgres, Keycloak):

   ```bash
   docker compose -p kairos-mcp --profile infra up -d
   ```

4. Start the KAIROS server:

   ```bash
   docker compose -p kairos-mcp --profile prod up -d
   ```

5. Confirm the server is healthy:

   ```bash
   curl http://localhost:3000/health
   ```

   A `200 OK` response confirms the server is running. Full developer workflow (build, test, lint, dev commands) is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Installation

- **Docker Compose (recommended)** — full stack with Redis and Qdrant; see
  the quick start above.

- **npm (CLI only)** — install the `kairos` command-line tool globally.
  Node.js 24 or later is required.

  ```bash
  npm install -g @debian777/kairos-mcp
  ```

  See [KAIROS CLI](docs/CLI.md) for usage.

For development setup and all `npm run` commands, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [Install KAIROS MCP in Cursor](docs/INSTALL-MCP.md)
- [KAIROS CLI reference](docs/CLI.md)
- [Architecture and protocol workflows](docs/architecture/README.md)
- [Protocol examples and challenge types](docs/examples/README.md)
- [All documentation](docs/README.md)

## Troubleshooting

**The server does not start.** Check that ports 3000, 6333 (Qdrant), and
6379 (Redis) are free. Run `docker compose -p kairos-mcp logs` to inspect
errors.

**Embeddings fail on startup.** Confirm `OPENAI_API_KEY` is set in
`.env.prod`, or configure a TEI (Text Embeddings Inference) endpoint with
`TEI_BASE_URL`.

**Health check returns 503.** Qdrant or Redis may still be initializing.
Wait 10–15 seconds, then retry.

**Container exits immediately.** Run
`docker compose -p kairos-mcp --profile prod logs app-prod` and look for
missing required environment variables.

## Support

- [Documentation](docs/README.md)
- [Issue tracker](https://github.com/debian777/kairos-mcp/issues)
- [Discussions](https://github.com/debian777/kairos-mcp/discussions)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, contribution
guidelines, and agent-facing design principles.

## License

MIT — see [LICENSE](LICENSE).
