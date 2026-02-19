# KAIROS protocol examples

This folder contains human-readable examples for building and running KAIROS protocols.

## Contents

- **[Challenge types](challenge-types.md)** — Reference for all four challenge types (`shell`, `mcp`, `user_input`, `comment`): when to use each, how to define the challenge in a step, what solution shape to send in `kairos_next`, and how the server validates.

## Related docs

- [Architecture and protocol workflows](architecture/README.md) — End-to-end flow (search → begin → next → run complete) and per-tool workflows.
- Building KAIROS workflows (challenge/solution, minting) is described in the MCP resource **building-kairos-workflows** and in the tool description for `kairos_mint`.
- [Agent-facing design principles](../../CONTRIBUTING.md#agent-facing-design-principles) — For contributors designing or reviewing MCP tools and APIs.
