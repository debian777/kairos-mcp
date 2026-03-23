# KAIROS MCP documentation

This directory documents the current behavior of the repository: how to run the
server, connect clients, use the CLI, understand the protocol engine, and work
on the codebase.

Start with the root [README](../README.md) for the product overview and the
quick start.

## Getting started

- [Install and environment](install/README.md) — minimal and fullstack env
  files, embedding-provider setup, and auth-related variables
- [Install KAIROS MCP in Cursor](INSTALL-MCP.md) — configure Cursor to talk to
  the HTTP MCP endpoint
- [CLI reference](CLI.md) — commands, auth flow, config/keyring behavior, and
  batch minting
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

- [Full execution workflow](architecture/workflow-full-execution.md)
- [kairos_search](architecture/workflow-kairos-search.md)
- [kairos_begin](architecture/workflow-kairos-begin.md)
- [kairos_next](architecture/workflow-kairos-next.md)
- [kairos_attest](architecture/workflow-kairos-attest.md)
- [kairos_mint](architecture/workflow-kairos-mint.md)
- [kairos_update](architecture/workflow-kairos-update.md)
- [kairos_delete](architecture/workflow-kairos-delete.md)
- [kairos_dump](architecture/workflow-kairos-dump.md)

## Examples and protocol authoring

- [Protocol examples](examples/README.md) — mintable example protocols
- [Challenge types](examples/challenge-types.md) — challenge/solution shapes
- [Deterministic slug routing](design/slug-deterministic-routing.md)

## Security and operations

- [Known issues and limitations](known-issues-and-limitations.md)
- [Security policy](../SECURITY.md)
- [Threat model](security/threat-model.md)
- [Incident runbook](security/incident-runbook.md)
- [Code security setup](security/code-security-setup.md)

## Skills and contributor guidance

- [Skills README](../skills/README.md)
- [Skills structure reference](../skills/SKILLS.md)
- [Contributing](../CONTRIBUTING.md)
