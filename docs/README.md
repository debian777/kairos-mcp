# KAIROS MCP documentation

KAIROS MCP automates AI agents and chats with persistent, deterministic
workflows. This folder contains setup guides, CLI reference, and protocol
workflow details.

## Start here

The [README](../README.md) covers what KAIROS MCP is, the quick start, and
all installation options. Read it first.

## Getting started

These guides walk you through connecting to and using KAIROS.

- [Install and environment](install/README.md) — env examples (minimal, fullstack); copy one to `.env`.
- [Install KAIROS MCP in Cursor](INSTALL-MCP.md) — add the KAIROS MCP
  server to Cursor and connect to a running KAIROS instance.
- [KAIROS CLI](CLI.md) — command-line usage: installation, configuration,
  and all available commands.
- [KAIROS bundles](kairos-bundles.md) — versioned trees of protocol markdown in
  Git; bulk import with `kairos mint --force -r` and `README.md` handling.

## Architecture and workflows

These documents explain how KAIROS works internally and how protocol chains
execute end-to-end.

- [Architecture and protocol workflows](architecture/README.md) — how the
  protocol runs end-to-end (search → begin → next → run complete),
  per-tool workflow reference, response shapes, and scenarios.
- [Authentication overview](architecture/auth-overview.md) — server auth (Bearer/session), shared CLI and MCP config, Keycloak, login flow.
- [Logging](architecture/logging.md) — log levels, standard fields, env vars, error codes.

## Business applications

- [Business application cases](business/README.md) — manager-focused examples:
  standardizing commits and MRs, compliance review from a new document (e.g. NIST),
  Terraform module standardization.

## Concepts

- [Skills that ship KAIROS protocols](../skills/README.md) —
  how a skill can bundle a protocol, declare requirements, and run
  search → mint if missing → execute.
- [Known issues and limitations](known-issues-and-limitations.md) —
  current limitations, upgrade policy, and where to find breaking changes.

## Examples

The examples show how to build and structure protocols.

- [Protocol examples and challenge types](examples/README.md) —
  human-readable examples for challenge types (`shell`, `mcp`,
  `user_input`, `comment`), step bodies, and solution shapes for
  `kairos_next`.

## For contributors

- [Developer commands](../CONTRIBUTING.md#developer-commands) — build, deploy, and test (`dev:build`, `dev:deploy`, `dev:test`). Always deploy before testing.
- [Agent-facing design principles](../CONTRIBUTING.md#agent-facing-design-principles)
  — doctrine for MCP tools, schemas, descriptions, and error shapes.

## Archived material

Older or superseded documents (phase snapshots, one-off reports, raw
scenario data) are kept for reference only and may not reflect current
behavior. Contact the maintainers if you need to locate a specific
historical document.
