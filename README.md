# KAIROS MCP

![KAIROS MCP logo](docs/design/logo-mockups/kairos-mcp-lockup.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org/)

KAIROS MCP™ gives AI agents persistent memory and deterministic protocol
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

**Minimal (default):** Qdrant + app only. No Redis or auth.

1. Download the Compose file and minimal env example:

   ```bash
   curl -LO https://raw.githubusercontent.com/debian777/kairos-mcp/main/compose.yaml
   curl -LO https://raw.githubusercontent.com/debian777/kairos-mcp/main/docs/install/env.example.minimal.txt
   cp env.example.minimal.txt .env
   ```

2. Set your embedding provider in `.env` (e.g. `OPENAI_API_KEY=sk-proj-...`).

3. Start the stack:

   ```bash
   docker compose -p kairos-mcp up -d
   ```

4. Confirm the server is healthy:

   ```bash
   curl http://localhost:3000/health
   ```

**Full stack (Redis, Postgres, Keycloak):** Use [docs/install/env.example.fullstack.txt](docs/install/env.example.fullstack.txt) as `.env`, set `REDIS_URL=redis://redis:6379` and your secrets, then:

   ```bash
   docker compose -p kairos-mcp --profile fullstack up -d
   ```

See [docs/install/README.md](docs/install/README.md) for env variants. Full developer workflow is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Installation

- **Docker Compose (recommended)** — minimal (Qdrant + app) by default, or
  full stack with Redis and Keycloak; see the quick start above.

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

**The server does not start.** Check that ports 3000 and 6333 (Qdrant) are free (6379 only if using fullstack). Run `docker compose -p kairos-mcp logs` to inspect errors.

**Embeddings fail on startup.** Confirm `OPENAI_API_KEY` is set in
`.env`, or configure a TEI (Text Embeddings Inference) endpoint with
`TEI_BASE_URL`.

**Health check returns 503.** Qdrant (and Redis if fullstack) may still be initializing. Wait 10–15 seconds, then retry.

**Container exits immediately.** Run `docker compose -p kairos-mcp logs app-prod` and look for missing required environment variables.

## Support

- [Documentation](docs/README.md)
- [Issue tracker](https://github.com/debian777/kairos-mcp/issues)
- [Discussions](https://github.com/debian777/kairos-mcp/discussions)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, contribution
guidelines, and agent-facing design principles.

## Trademark

KAIROS MCP™ and the KAIROS MCP logo are trademarks of the project.

The software is open source under the MIT License,
but the name and branding are not covered by that license.

Forks must remove the KAIROS MCP branding.

See [TRADEMARK.md](TRADEMARK.md) for details.

## License

MIT — see [LICENSE](LICENSE).
