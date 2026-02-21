# KAIROS protocol examples

This folder contains **markdown protocols ready for minting** and a short reference for challenge types and solution shapes. These examples are the canonical source for **dev/qa workflow tests**: imports, search + workflows, update step, and update chain.

## Mintable protocols

Each file below is a complete protocol (H1 + H2 steps with ` ```json ` challenge blocks). Copy its content and pass it to `kairos_mint`.

| File | Challenge type(s) | MCP-only (no shell) |
|------|-------------------|----------------------|
| [protocol-example-shell.md](protocol-example-shell.md) | shell | No |
| [protocol-example-user-input.md](protocol-example-user-input.md) | user_input | Yes |
| [protocol-example-comment.md](protocol-example-comment.md) | comment | Yes |
| [protocol-example-mcp.md](protocol-example-mcp.md) | mcp | Yes |
| [protocol-example-all-types.md](protocol-example-all-types.md) | shell, mcp, user_input, comment | No |

**MCP-only** means the protocol has no `shell` challenge; safe for workflow tests that forbid shell and local filesystem (only MCP tools and writing to `reports/`).

## Use in dev/qa workflow tests

- **Imports:** Mint each mintable example via `kairos_mint` (e.g. from integration tests or an agent). See [Workflow test README](../../tests/workflow-test/README.md).
- **Search + workflows:** After minting, use `kairos_search` → choose chain → `kairos_begin` → `kairos_next` (loop) until run complete.
- **Update step / update chain:** Use `kairos_search` or existing URI, `kairos_dump` for content, then `kairos_update` with edited `markdown_doc` (one step or multiple URIs).

When running **MCP-only** workflow tests (no shell, no filesystem except `reports/`), use only the MCP-only protocols above or protocols you mint that contain no shell step.

## Reference

- **[Challenge types](challenge-types.md)** — Table of mintable docs, how to mint, and solution shapes for `kairos_next`.

## Related docs

- [Architecture and protocol workflows](../architecture/README.md) — End-to-end flow (search → begin → next → run complete) and per-tool workflows.
- [Workflow test prompt and report format](../../tests/workflow-test/README.md) — How to run workflow tests and where to write reports.
- Building KAIROS workflows is described in the MCP resource **building-kairos-workflows** and in the tool description for `kairos_mint`.
- [Agent-facing design principles](../../CONTRIBUTING.md#agent-facing-design-principles) — For contributors designing or reviewing MCP tools and APIs.
