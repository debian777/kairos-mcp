# KAIROS protocol examples

This folder contains **markdown protocols ready for minting** and a short reference for challenge types and solution shapes.

## Mintable protocols

Each file below is a complete protocol (H1 + H2 steps with ` ```json ` challenge blocks). Copy its content and pass it to `kairos_mint`.

- **[protocol-example-shell.md](protocol-example-shell.md)** — One step: shell challenge (run a command).
- **[protocol-example-user-input.md](protocol-example-user-input.md)** — One step: user_input (human confirmation).
- **[protocol-example-comment.md](protocol-example-comment.md)** — One step: comment (verification text, min length).
- **[protocol-example-mcp.md](protocol-example-mcp.md)** — One step: mcp (call an MCP tool).
- **[protocol-example-all-types.md](protocol-example-all-types.md)** — Four steps: shell, mcp, user_input, comment.

## Reference

- **[Challenge types](challenge-types.md)** — Table of mintable docs, how to mint, and solution shapes for `kairos_next`.

## Related docs

- [Architecture and protocol workflows](../architecture/README.md) — End-to-end flow (search → begin → next → run complete) and per-tool workflows.
- Building KAIROS workflows is described in the MCP resource **building-kairos-workflows** and in the tool description for `kairos_mint`.
- [Agent-facing design principles](../../CONTRIBUTING.md#agent-facing-design-principles) — For contributors designing or reviewing MCP tools and APIs.
