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

KAIROS MCP wins by being the most reliable “memory + protocol” substrate that agent hosts can depend on. We focus on a small set of primitives that compose into many workflows, schemas and error messages that minimize agent confusion, and backends that orchestrate complexity so the agent-facing surface stays simple.

**Success** means new clients can implement the tool flow without guesswork; execution is repeatable and traceable; and the system can evolve without breaking agents or requiring hidden tribal knowledge.

## Non-goals

KAIROS MCP does not try to be: a general-purpose agent framework or planner; a vector DB or database abstraction; a UI product for humans (agents are the primary users); or a place to store secrets, credentials, or regulated personal data.

---

KAIROS is an MCP (Model Context Protocol) server that provides persistent knowledge memory for AI agents, enabling them to store, retrieve, and reason over information across sessions.

## Build, Deploy, and Test

All build, deploy, and test operations are available as npm scripts.

> **Warning:** Always deploy before testing. Tests run against running dev/qa
> servers, so you must deploy your changes first using `npm run dev:deploy` (or
> `npm run qa:deploy`) before running tests.

### Build

```bash
# Build TypeScript to JavaScript (outputs to dist/)
npm run build

# Build for development environment (includes linting)
npm run dev:build

# Build for QA environment (includes linting)
npm run qa:build
```

### Deploy

```bash
# Deploy to development environment (build + restart)
npm run dev:deploy

# Deploy to QA environment (build + start)
npm run qa:deploy
```

### Test

> **Warning:** Deploy before testing. Tests require the server to be running
> with your latest changes.

```bash
# Standard workflow: Deploy first, then test
npm run dev:deploy && npm run dev:test
npm run qa:deploy && npm run qa:test

# Individual test commands (only use if server is already deployed)
npm run dev:test
npm run qa:test
```

**Why deploy first?** Tests connect to the running MCP server. If you've made code changes, you must deploy them (`npm run dev:deploy`) so the server runs your updated code before tests execute.

### Development Environment Management

```bash
# Start development server
npm run dev:start

# Stop development server
npm run dev:stop

# Restart development server
npm run dev:restart

# View development logs
npm run dev:logs

# Check development server status
npm run dev:status

# Access Redis CLI (development)
npm run dev:redis-cli

# Access Qdrant via curl (development)
npm run dev:qdrant-curl
```

### QA Environment Management

```bash
# Start QA server
npm run qa:start

# Stop QA server
npm run qa:stop

# Restart QA server
npm run qa:restart

# View QA logs
npm run qa:logs

# Check QA server status
npm run qa:status

# Access Redis CLI (QA)
npm run qa:redis-cli

# Access Qdrant via curl (QA)
npm run qa:qdrant-curl
```

## CLI Usage

The KAIROS CLI provides a command-line interface for interacting with the KAIROS REST API.

See [docs/CLI.md](docs/CLI.md) for complete CLI documentation, including installation, configuration, and all available commands.

## Snapshot Management

You can back up the Qdrant vector database in two ways:

- Enable automatic Qdrant backups on boot by setting
  `QDRANT_SNAPSHOT_ON_START=true`. Use `QDRANT_SNAPSHOT_DIR` to control where
  snapshot files are written (defaults to `data/qdrant/snapshots`).
- Trigger an on-demand snapshot against the running server with
  `POST /api/snapshot`. The response includes the snapshot file path, byte
  size, and status so you can plug it into backup automation.

### Code Quality

```bash
# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix

# Verify clean source (checks for uncommitted changes)
npm run verify:clean
```

### Docker

```bash
# Build Docker image
npm run docker:build
```

## Project Structure

- `src/` - Source TypeScript code
- `src/embed-docs/` - Embedded MCP resources (prompts, tools, templates)
- `dist/` - Compiled JavaScript output
- `tests/` - Test files
- `tests/test-data/` - Test data files
- `scripts/` - Build and utility scripts

## Infrastructure Setup

Start the required infrastructure services (Redis and Qdrant):

```bash
npm run infra:start
```

This starts Redis and Qdrant using Docker Compose with the infrastructure profile.

## Requirements

- Node.js >= 24.0.0
- Docker and Docker Compose (for containerized deployment)
- Qdrant (vector database)
- Redis (caching)

## Installation

```bash
# Clone the repository
git clone https://github.com/debian777/kairos-mcp.git
cd kairos-mcp

# Install dependencies
npm ci

# Copy environment template
cp env.example.txt .env.dev

# Configure your environment variables in .env.dev
# See env.example.txt for all available options

# Start infrastructure
npm run infra:start

# Start development server
npm run dev:start
```

## Contributing

Contributions are welcome. Read the [Contributing Guide](CONTRIBUTING.md) for
details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/README.md)
- 📐 [Agent-facing design principles](CONTRIBUTING.md#agent-facing-design-principles)
  — for contributors designing or reviewing MCP tools and APIs
- 🐛 [Issue Tracker](https://github.com/debian777/kairos-mcp/issues)
- 💬 [Discussions](https://github.com/debian777/kairos-mcp/discussions)
