# Contributing to KAIROS MCP

KAIROS MCP is an MCP server for persistent memory and deterministic
protocol-chain execution. This document is the definitive contract for
contributors: setup, workflow, code conventions, and PR requirements.

## Code of conduct

Participants must maintain a respectful and inclusive environment.

## Prerequisites

- Node.js >= 24.0.0
- Docker and Docker Compose (v2)
- Git

## Setup from clone to passing tests

1. Fork the repository on GitHub.
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kairos-mcp.git
   cd kairos-mcp
   ```
3. Install dependencies:
   ```bash
   npm ci
   ```
4. Copy the example env file and configure required variables:
   ```bash
   cp docs/install/env.example.fullstack.txt .env
   # Edit .env — set QDRANT_URL, OPENAI_API_KEY or TEI_BASE_URL,
   # and any auth vars if AUTH_ENABLED=true.
   ```
5. Start infrastructure (Redis, Qdrant, Postgres, Keycloak):
   ```bash
   npm run infra:up
   ```
6. Deploy and run tests:
   ```bash
   npm run dev:deploy && npm run dev:test
   ```

All tests pass against a running dev server. Deploy before testing —
tests run against the live process, not in-process.

## Developer commands

All build, deploy, and test operations are npm scripts. **Always deploy before testing:** tests run against the running dev server, so deploy your changes first.

**Build**

```bash
npm run dev:build    # lint + TypeScript → dist/ (dev)
```

**Deploy**

```bash
npm run dev:deploy   # dev:build + restart dev server
```

**Test**

Deploy first, then run only what you need. Prefer a single test file during development instead of the full suite.

```bash
# Deploy so the dev server has your changes
npm run dev:deploy

# Run a single test file (recommended while iterating)
npm run dev:test -- tests/integration/kairos-dump.test.ts

# Run the full integration suite when done or before PR
npm run dev:test
```

To test without Keycloak, set `AUTH_ENABLED=false` in `.env`, then
deploy and test. To override without editing the file:

```bash
AUTH_ENABLED=false npm run dev:test
```

**Test with Keycloak (AUTH_ENABLED=true)**

Jest global-setup starts Keycloak via Testcontainers when `KEYCLOAK_URL`
is unset, provisions the test user, and writes
`.test-auth-env.dev.json`. The app must already be running.

```bash
npm run dev:deploy
KEYCLOAK_URL= AUTH_ENABLED=true npm run dev:test -- \
  tests/integration/auth-keycloak.test.ts
```

**Dev environment controls**

```bash
npm run dev:start     # start
npm run dev:stop      # stop
npm run dev:restart   # restart
npm run dev:logs      # view logs
npm run dev:status    # check status
npm run dev:redis-cli # Redis CLI (dev)
npm run dev:qdrant-curl # Qdrant via curl (dev)
```

**Infrastructure**

```bash
# Starts Redis, Qdrant, Postgres, Keycloak.
# Requires KEYCLOAK_ADMIN_PASSWORD and KEYCLOAK_DB_PASSWORD in .env.
npm run infra:up
```

**Code quality**

```bash
npm run lint          # ESLint
npm run lint:fix      # ESLint with auto-fix
npm run verify:clean  # check for uncommitted changes
npm run knip          # dead code / unused exports
```

**Docker**

```bash
npm run docker:build  # build image (debian777/kairos-mcp)
```

**Snapshot management**

Set `QDRANT_SNAPSHOT_ON_START=true` to enable automatic Qdrant backups on
boot. Override `QDRANT_SNAPSHOT_DIR` for the path (default `/snapshots`
in Docker; use `./data/qdrant/snapshots` in dev). Trigger on demand:
`POST /api/snapshot`.

## Project structure

```
src/               TypeScript source
src/embed-docs/    Built-in protocol chains embedded as MCP resources
dist/              Compiled output (generated)
tests/             Test files
tests/test-data/   Test fixtures
tests/workflow-test/ Agent workflow test prompt and instructions
reports/           Workflow test output (gitignored except .gitkeep)
docs/examples/     Mintable protocol examples for dev workflow tests
scripts/           Build and utility scripts
```

## Contribution workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes.
3. Run tests: `npm run dev:deploy && npm run dev:test`
4. Run the full handoff check: `npm run handoff`
5. Commit with a descriptive message (see commit conventions below).
6. Push and open a pull request against `main`.

## Commit conventions

Use these prefixes:

- `Add:` — new feature
- `Fix:` — bug fix
- `Update:` — change to an existing feature
- `Refactor:` — internal restructuring without behavior change
- `Docs:` — documentation only
- `Test:` — test additions or changes

## PR requirements

- All tests pass (`npm run dev:test`).
- `npm run handoff` completes without errors.
- Docs are updated when behavior changes.
- Branch is up to date with `main`.
- PR description states what changed, why, and how to test it.

## Code style

- **Language:** TypeScript for all source files.
- **Linter:** ESLint. Run `npm run lint` before committing. Use
  `npm run lint:fix` for auto-fixable issues. The pre-commit hook runs
  lint automatically; version-bump commits (only `package.json` and
  `package-lock.json` staged) skip hooks so no `--no-verify` is needed.
- **Imports:** Use `.js` extensions on relative imports (Node ESM).
- **Naming:** `camelCase` for variables and functions; `PascalCase` for
  classes and types; `SCREAMING_SNAKE_CASE` for module-level constants
  read from the environment.
- **Files:** One primary export per file; filename matches the export
  (for example, `structured-logger.ts` exports `structuredLogger`).
- **Error handling:** Throw typed errors or return structured error
  objects. Never swallow errors silently. Include `error_code` and
  `request_id` in log payloads at the call site.
- **Logger:** Use `structuredLogger` (from
  `src/utils/structured-logger.ts`) for HTTP/MCP request flow. Use
  `logger` (from `src/utils/logger.ts`) for services. See
  [docs/logging.md](docs/logging.md) for levels, fields, and examples.
- **Tests:** Write integration tests for new tools and API endpoints.
  Place them in `tests/integration/`.

## Multitenancy (Qdrant + Redis) audit checklist

When adding or changing code that touches Qdrant or Redis, verify:

- **Allowed spaces:** Derive only from the verified token or session
  (Keycloak `sub` + `groups`). Never trust client-supplied space lists.
- **Qdrant reads:** Search uses `getSearchSpaceIds()` (allowedSpaceIds +
  Kairos app space). Scroll and filter operations use
  `getSpaceContext().allowedSpaceIds`. Every retrieve-by-id must check
  that the point's `space_id` is in `allowedSpaceIds`; otherwise treat
  as not found (404).
- **Qdrant writes:** Every upsert includes `space_id` from
  `getSpaceContext().defaultWriteSpaceId` or a validated parameter. The
  Kairos app space is read-only for users.
- **Redis:** Keys are namespaced by space via `getKey()` (prefix +
  space id + key). Each request runs inside `runWithSpaceContext()`.
- **Optional space param:** Validate HTTP query `space` / `space_id`
  and MCP tool args against `allowedSpaceIds`; invalid → 400/403.

See [docs/architecture/auth-urls-qa.md](docs/architecture/auth-urls-qa.md)
for Keycloak URL routing and the full multitenancy rules.

## Principles

These principles apply to architecture, APIs, code, and documentation.

- **Agents are the primary users.** Optimize the interface for agent
  execution, not human aesthetics.
- **Determinism over ambiguity.** Prefer one correct next action over
  many possible actions.
- **Teach in the interface.** Tool descriptions, schemas, and errors
  must explain what to do next.
- **Server generates; agent echoes.** Identifiers, nonces, and proof
  hashes are server-owned. The agent copies them back exactly.
- **Backend orchestrates complexity.** Validation, retries, state,
  idempotency, and integrations live behind the interface.
- **Make failure recoverable.** Errors must be actionable. Retry paths
  must be explicit.
- **Keep the core small.** Add primitives only when they unlock many
  workflows or eliminate systemic failure modes.

## Agent-facing design principles

Apply these when contributing MCP tools, agent-facing REST APIs, or
changes to tool schemas and descriptions.

### 1. MCP users are AI agents

Primary users are AI agents, not humans. Design for programmatic
consumption. Every field name, description, and instruction is written
for LLM comprehension. Avoid vague messages like "Try again"; use
structured, actionable instructions.

### 2. LLM-friendly frontend

- **Consistent names.** Same concept = same name everywhere.
- **Unambiguous instructions.** Spell out exactly what to do.
- **Server generates; agent echoes.** Hashes, nonces, and identifiers
  are server-owned; the agent copies them back exactly.
- **Describe field purpose in schema** so the agent knows when and how
  to use each field.
- **Errors teach, don't punish.** Error messages must guide the agent
  to correct and retry.

### 3. Frontend vs backend roles

- **Frontend (MCP tools, schemas, descriptions):** Optimize for agent
  comprehension and execution.
- **Backend:** Orchestrate complexity — business logic, validation,
  retries, idempotency, and state.
- **Spaces: names at the frontend, IDs in the backend.** Tool
  parameters and responses use space **names**. The backend resolves
  names to space **IDs** for Qdrant filters and Redis keys.

### 4. Outputs designed for execution

- **Embed URIs in `next_action`.** Prefer `next_action` with exact URIs
  and instructions the agent can copy.
- **Always provide an actionable next step** on success.
- **`must_obey` semantics:** `must_obey: true` means the agent must
  follow `next_action`; `must_obey: false` means the agent may choose
  among options.
- **Unify response shapes** across tools to reduce patterns the agent
  must learn.

### 5. Error outputs that help execution

- **Errors are recoverable by default.** Include fresh challenge data
  on error so the agent can retry without re-fetching.
- **Include `next_action` in errors** with exact retry instructions.
- **Use structured error codes** for monitoring and agent branching.
- **Retry escalation:** Retries 1–N use `must_obey: true` with a
  deterministic correction path. After N retries, `must_obey: false`
  allows repair, abort, or escalation.
- Use a circuit breaker to avoid infinite retry loops.

### 6. Self-correcting workflows

- Support repair paths (for example, update the step or abort after
  max retries).
- When search finds no match, offer a deterministic "create new
  protocol" path.
- Keep attestation a simple stamp; make the last step a normal
  verification step.

### 7. Checklist for new or changed APIs

- [ ] Outputs use LLM-friendly, consistent field names.
- [ ] `next_action` embeds exact URIs and instructions.
- [ ] Errors include recovery instructions and fresh data to retry.
- [ ] Two-phase error handling: retry first, then grant autonomy.
- [ ] No redundant fields; single source of truth for each concept.
- [ ] Server generates identifiers and hashes; agent echoes them.
- [ ] Self-correction paths (for example, `kairos_update`) are exposed
      and documented.
- [ ] A creation fallback exists when no match is found.

## Constraints

KAIROS MCP must remain safe to run in production with clear environment
separation (dev/live). Agent-facing changes must preserve backward
compatibility or provide explicit upgrade paths. Operational dependencies
(Redis + Qdrant) must be predictable; avoid hidden state.

## Decision rules

When goals conflict:

1. Correctness and determinism over convenience.
2. Interface that reduces agent errors over interface that reduces
   developer typing.
3. Changes that simplify the agent-facing surface over moving complexity
   into agents.

## Reporting issues

Include:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS)
- Relevant logs or error messages

## Feature requests

Open an issue with a description, use case, and any proposed
implementation.

## Questions

Open an issue for questions or discussion.
