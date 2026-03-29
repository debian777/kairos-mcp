# KAIROS MCP documentation

This directory documents the current behavior of the repository: how to run the
server, connect clients, use the CLI, understand the protocol engine, and work
on the codebase.

Start with the root [README](../README.md) for the product overview and the
quick start.

## Getting started

All installation guides are under **[install/](install/README.md)**. Highlights:

- [Install index](install/README.md) — entry point and diagram
- [Environment variables and secrets](install/env-and-secrets.md) — `.env`,
  embeddings, Redis URL, variable table
- [Docker Compose — simple stack](install/docker-compose-simple.md) — Qdrant +
  app (default profile)
- [Optional `fullstack` Compose note](install/docker-compose-full-stack.md) — not
  a Keycloak install guide
- [Keycloak notes (operators)](keycloak/google-auth-dev.md) — outside install path
- [Cursor and MCP](install/README.md#cursor-and-mcp) — `mcp.json`, HTTP-only MCP
  (not stdio)
- [CLI reference](CLI.md) — `kairos` / `npx @debian777/kairos-mcp`, auth, batch
  training
- [KAIROS bundles](kairos-bundles.md) — bundle layout plus export/import paths

## Architecture and behavior

- [Architecture overview](architecture/README.md) — entry point into transport,
  auth, storage, UI, and tool workflow docs
- [Authentication overview](architecture/auth-overview.md) — browser session,
  Bearer validation, shared CLI/MCP token storage, and well-known discovery
- [Infrastructure](architecture/infrastructure.md) — Compose topology, ports,
  volumes, startup, and service relationships
- [Search query architecture](architecture/search-query.md) — hybrid Qdrant
  search, space scoping, and score shaping
- [Logging](architecture/logging.md) — logger behavior, audit stream, and
  metrics-related env vars

## Tool workflows

- [Architecture and protocol workflows](architecture/README.md) — how the
  protocol runs end-to-end (**activate** → **forward** → **reward**),
  per-tool references, response shapes, and companion workflow page mapping.
- [Full execution workflow](architecture/workflow-full-execution.md) —
  end-to-end walkthrough with example calls.
- Companion workflow pages:
  [workflow-activate](architecture/workflow-activate.md),
  [workflow-forward-first-call](architecture/workflow-forward-first-call.md),
  [workflow-forward-continue](architecture/workflow-forward-continue.md),
  [workflow-reward](architecture/workflow-reward.md),
  [workflow-train](architecture/workflow-train.md),
  [workflow-tune](architecture/workflow-tune.md),
  [workflow-delete](architecture/workflow-delete.md),
  [workflow-export](architecture/workflow-export.md).

## Examples and protocol authoring

- [Protocol examples](examples/README.md) — trainable example adapters
- [Challenge types](examples/challenge-types.md) — challenge/solution shapes

## Security and operations

- [Known issues and limitations](known-issues-and-limitations.md)
- [Security policy](../SECURITY.md)
- [Threat model](security/threat-model.md)
- [Incident runbook](security/incident-runbook.md)
- [Code security setup](security/code-security-setup.md)
- [Skills that ship KAIROS protocols](../skills/README.md) — how a skill can
  bundle a protocol, declare requirements, and run **activate** → **train** if
  missing → **forward** / **reward**.

## Skills and contributor guidance

- [Skills README](../skills/README.md)
- [Skills structure reference](../skills/SKILLS.md)
- [Contributing](../CONTRIBUTING.md)
- [Developer commands](../CONTRIBUTING.md#developer-commands) — build, deploy,
  and test (`dev:build`, `dev:deploy`, `dev:test`). Always deploy before testing.
- [Agent-facing design principles](../CONTRIBUTING.md#agent-facing-design-principles)
  — doctrine for MCP tools, schemas, descriptions, and error shapes.

## Archived material

Older or superseded documents (phase snapshots, one-off reports, raw scenario
data) are kept for reference only and may not reflect current behavior. Contact
the maintainers if you need to locate a specific historical document.
