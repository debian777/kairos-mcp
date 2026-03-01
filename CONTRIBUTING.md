# Contributing to KAIROS MCP

Thank you for your interest in contributing to KAIROS MCP! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/kairos-mcp.git` (replace YOUR_USERNAME with your GitHub username)
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm ci`
5. Make your changes
6. Test your changes: `npm test` (dev/memory); `npm run test:integration` (starts infra, runs tests, shuts down)
7. Commit your changes: `git commit -m "Add: your feature description"`
8. Push to your fork: `git push origin feature/your-feature-name`
9. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js >= 24.0.0
- Docker and Docker Compose (for integration tests and full stack)
- Qdrant (vector database)
- Redis (optional; unset REDIS_URL for in-memory backend)

### Environment Setup

1. Run `node scripts/generate_dev_secrets.mjs` to create `.env` (single file, all enabled). Or copy `env.example.txt` to `.env` and edit.
2. Configure required environment variables (see `env.example.txt` for details).
3. For full stack: `npm run infra:up` (Redis, Qdrant, Postgres, Keycloak; uses `.env`).
4. Run app: `npm run dev` or `npm start` (both start Qdrant if needed, then the app; use `.env`).

### Developer commands

**Run app (Qdrant runs with app)**

```bash
npm run dev    # Start Qdrant if needed, then hot-reload from source (uses .env)
npm start      # Start Qdrant if needed, then run built app from dist/ (uses .env)
npm run stop   # Stop app process and bring down Qdrant (profile app)
```

**Build**

```bash
npm run build     # verify:clean + embed-docs + tsc
npm run clean     # Remove dist/
```

**Test**

```bash
npm test                    # AUTH_ENABLED=false REDIS_URL= → memory backend, no auth (no .env loaded)
npm run test:integration    # Starts full infra, runs test suite, shuts down (one command)
```

One `.env` with all enabled. Plain `npm test` overrides `AUTH_ENABLED=false` and `REDIS_URL=` so tests run without auth and with in-memory store. `npm run test:integration` starts Docker infra (Redis, Qdrant, Postgres, Keycloak), configures Keycloak, starts the app, runs Jest, then stops the app and brings down infra.

**Test with auth (Keycloak + kairos-tester)**  
When running `test:integration`, the script starts infra and the app; Jest globalSetup loads `.env`, provisions the test user and token, and writes `.test-auth-env.dev.json`.

**Validation gate (before publish)**

```bash
npm run validate   # lint + knip + build + npm test + test:integration (test:integration starts/stops its own infra)
```

**Infrastructure**

```bash
npm run infra:up    # Start full stack: Redis, Qdrant, Postgres, Keycloak (profile infra)
npm run infra:down  # Stop full stack. Qdrant also runs with app (profile app); npm run stop brings that down.
```

**Code quality**

```bash
npm run lint         # Run linter
npm run lint:fix     # Lint with auto-fix
npm run knip         # Unused exports / dead code
npm run verify:clean # Check for uncommitted changes
```

**Docker**

```bash
npm run docker:build   # Build image (debian777/kairos-mcp)
npm run docker:push   # Push image
```

**Snapshot management (optional)**

- Enable automatic Qdrant backups on boot: `QDRANT_SNAPSHOT_ON_START=true`; use `QDRANT_SNAPSHOT_DIR` for path (default `/snapshots` in Docker; override in dev e.g. `./data/qdrant/snapshots`).
- On-demand snapshot: `POST /api/snapshot`; response includes file path, size, and status.

**Project structure**

- `src/` — Source TypeScript; `src/embed-docs/` — embedded MCP resources
- `dist/` — Compiled output
- `tests/` — Test files; `tests/test-data/` — test data; `tests/workflow-test/` — agent workflow test prompt and instructions (MCP-only, output to `reports/`)
- `reports/` — Workflow test output (gitignored except `.gitkeep`): `reports/<run-id>/report.md` and `reports/<run-id>/calls/*.json`
- `docs/examples/` — Mintable protocol examples used in dev/qa workflow tests (imports scenario)
- `scripts/` — Build and utility scripts

**CLI**

See [docs/CLI.md](docs/CLI.md) for the KAIROS CLI (installation, configuration, commands).

## Multitenancy (Qdrant + Redis) audit checklist

When adding or changing code that touches Qdrant or Redis, ensure:

- **Allowed spaces:** Only from verified token/session (Keycloak `sub` + `groups`). Never trust client-supplied space lists.
- **Qdrant reads:** Search uses `getSearchSpaceIds()` (allowedSpaceIds + Kairos app space) so protocol discovery includes app-provided protocols. Other `scroll`/filter operations use `getSpaceContext().allowedSpaceIds`. Every retrieve-by-id is followed by a check that the point's `space_id` is in `allowedSpaceIds`; otherwise treat as not found (404).
- **Qdrant writes:** Every upsert includes `space_id` from `getSpaceContext().defaultWriteSpaceId` or a validated param. No upsert without a server-derived `space_id`. The Kairos app space is read-only for users (writes only at boot via injectMemResourcesAtBoot).
- **Redis:** Keys are namespaced by space via `getKey()` (prefix + space id + key). Request runs inside `runWithSpaceContext()` so `getSpaceIdFromStorage()` is set by auth middleware.
- **Optional space param:** HTTP query `space` / `space_id` and MCP tool args must be validated against `allowedSpaceIds`; invalid → 400/403.

See [docs/plans/keycloak-oidc-dev.md](docs/plans/keycloak-oidc-dev.md) and the Qdrant multitenancy plan for full MUST ALWAYS / MUST NEVER rules.

## Principles

These principles are project-wide. Apply them to architecture, APIs, code, and documentation.

- **Agents are the primary users.** Optimize the interface for agent execution, not for human aesthetics.
- **Determinism over ambiguity.** Prefer one correct next action over many “possible” actions.
- **Teach in the interface.** Tool descriptions, schemas, and errors must explain what to do next.
- **Server generates; agent echoes.** Identifiers, nonces, and proof hashes are server-owned. The agent copies them back exactly.
- **Backend orchestrates complexity.** Validation, retries, state, idempotency, and integrations live behind the interface.
- **Make failure recoverable.** Errors must be actionable. Retry paths must be explicit.
- **Keep the core small.** Add primitives only when they unlock many workflows or eliminate systemic failure modes.

## Agent-facing design principles

When contributing **MCP tools**, **agent-facing REST APIs**, or changes to tool schemas and descriptions, follow the doctrine below so the interface stays LLM-friendly and execution-oriented.

### 1. MCP users are AI agents

- Primary users are AI agents, not humans. Design for programmatic consumption.
- Every field name, description, and instruction is written for LLM comprehension.
- Avoid human-centric UX (e.g. vague “Try again” messages). Use structured, actionable instructions.

### 2. LLM-friendly frontend (names, descriptions, errors)

- **Clear, consistent names** across tools and parameters. Same concept = same name everywhere.
- **Unambiguous instructions.** Spell out exactly what to do.
- **Server generates; agent echoes.** Hashes, nonces, and identifiers are server-owned; the agent copies them back exactly.
- **Describe field purpose in schema** so the agent knows when and how to use each field.
- **Errors teach, don’t punish.** Error messages must guide the agent to correct and retry. Recovery is the default.

### 3. Frontend vs backend roles

- **Frontend (MCP tools, schemas, descriptions):** Optimize for agent comprehension and execution.
- **Backend:** Orchestrate complexity: business logic, validation, retries, idempotency, and state.
- **Spaces: names at the frontend, ids in the backend.** Tool parameters and tool/API responses that refer to spaces use **names** (e.g. `"personal"`, group name, `"Kairos app"`). The backend resolves names to space **ids** and uses only ids for Qdrant filters, Redis keys, and storage. Agents never see or echo raw space ids unless required for debugging; the interface stays name-based.

### 4. Outputs designed for execution

- **Embed URIs in `next_action`.** Prefer `next_action` that includes exact URIs and instructions the agent can copy.
- **Always provide an actionable next step** on success.
- **`must_obey` semantics:** `must_obey: true` = agent must follow `next_action`; `must_obey: false` = agent may choose among options.
- **Unify response shapes** across tools to reduce patterns the agent must learn.

### 5. Error outputs that help execution

- **Errors are recoverable by default.** Include fresh challenge data on error so the agent can retry without re-fetching.
- **Include `next_action` in errors** that explains exactly how to retry using the data from that response.
- **Use structured error codes** for monitoring and for the agent to branch on.
- **Retry escalation:** Retries 1–N: `must_obey: true` with a deterministic correction path; after N: `must_obey: false` to allow repair, abort, or escalation.
- Use a circuit breaker to avoid infinite loops and retry storms.

### 6. Self-correcting workflows

- Support repair paths (e.g. update the step or abort after max retries).
- When search finds no match, offer a deterministic “create new protocol” path.
- Keep attestation a simple stamp; make the last step a normal verification step.

### 7. Checklist for new or changed APIs

- [ ] Outputs use LLM-friendly, consistent field names.
- [ ] `next_action` embeds exact URIs and instructions.
- [ ] Errors include recovery instructions and fresh data to retry.
- [ ] Two-phase error handling: retry first, then grant autonomy.
- [ ] No redundant fields; single source of truth for each concept.
- [ ] Server generates identifiers/hashes; agent echoes them.
- [ ] Self-correction paths (e.g. `kairos_update`) are exposed and documented.
- [ ] Creation fallback exists when no match is found.

## Constraints

KAIROS MCP must remain safe to run in production with clear environment separation (dev/qa/live); preserve backward compatibility or provide explicit upgrade paths for agent-facing changes; and maintain predictable operational dependencies (Redis + Qdrant) and avoid hidden state.

## Decision rules

When goals conflict: (1) Pick correctness and determinism over convenience. (2) Pick an interface that reduces agent errors over one that reduces developer typing. (3) Pick changes that simplify the agent-facing surface over moving complexity into agents.

## Code Style

- Follow the existing code style
- Run the linter before committing: `npm run lint`
- Auto-fix linting issues: `npm run lint:fix`
- Use TypeScript for all new code
- Write tests for new features

## Commit Messages

Use clear, descriptive commit messages. We follow conventional commit format:

- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for updates to existing features
- `Refactor:` for code refactoring
- `Docs:` for documentation changes
- `Test:` for test additions or changes

## Pull Request Process

1. Ensure your code passes all tests
2. Update documentation if needed
3. Ensure your branch is up to date with `main`
4. Create a clear PR description explaining:
   - What changes were made
   - Why the changes were made
   - How to test the changes

## Reporting Issues

Include the following so we can reproduce and fix the issue:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant logs or error messages

## Feature Requests

Open an issue with:

- Clear description of the feature
- Use case and motivation
- Proposed implementation (if you have ideas)

## Questions?

Open an issue for questions or discussions.

Thank you for contributing to KAIROS MCP!
