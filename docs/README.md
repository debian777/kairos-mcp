# KAIROS MCP documentation

This folder contains documentation for KAIROS MCP: setup guides, CLI
reference, and protocol workflow details.

## Start here

The [README](../README.md) covers what KAIROS MCP is, the quick start, and
all installation options. Read it first.

## Getting started

These guides walk you through connecting to and using KAIROS.

- [Install and environment](install/README.md) — env examples (minimal, fullstack, full reference); copy one to `.env`.
- [Install KAIROS MCP in Cursor](INSTALL-MCP.md) — add the KAIROS MCP
  server to Cursor and connect to a running KAIROS instance.
- [KAIROS CLI](CLI.md) — command-line usage: installation, configuration,
  and all available commands.

## Architecture and workflows

These documents explain how KAIROS works internally and how protocol chains
execute end-to-end.

- [Architecture and protocol workflows](architecture/README.md) — how the
  protocol runs end-to-end (search → begin → next → run complete),
  per-tool workflow reference, response shapes, and scenarios.

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
