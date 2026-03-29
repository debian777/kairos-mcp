# KAIROS protocol examples

This folder contains **markdown adapters ready for `train`** and a short reference for challenge types and solution shapes. These examples are the canonical source for **dev/qa workflow tests**: imports, activate + run, update layer, and update adapter.

## Example protocols

Each file below is a complete protocol (H1 + H2 steps with ````json` challenge blocks). Every example ends with a **final step** with no challenge: "Show the output from [prior step(s)] to the user." Only reachable after all prior challenges are solved. The agent just shows the prior output to the user; no additional challenge to solve.


| File                                                             | Challenge type(s)               | MCP-only (no shell) |
| ---------------------------------------------------------------- | ------------------------------- | ------------------- |
| [protocol-example-shell.md](protocol-example-shell.md)           | shell                           | No                  |
| [protocol-example-user-input.md](protocol-example-user-input.md) | user_input                      | Yes                 |
| [protocol-example-comment.md](protocol-example-comment.md)       | comment                         | Yes                 |
| [protocol-example-mcp.md](protocol-example-mcp.md)               | mcp                             | Yes                 |
| [protocol-example-all-types.md](protocol-example-all-types.md)   | shell, mcp, user_input, comment | No                  |


**MCP-only** means the protocol has no `shell` challenge; safe for workflow tests that forbid shell and local filesystem (only MCP tools and writing to `reports/`).

## Use in dev/qa workflow tests

- **Imports:** Train each example below via **`train`** (e.g. from integration tests or an agent). See [Workflow test README](../../tests/workflow-test/README.md).
- **Activate + run:** After training, use **`activate`** → pick a choice → **`forward`** (loop with `solution` per layer) until **`reward`** completes the run.
- **Update layer / update adapter:** Use **`activate`** or an existing URI, **`export`** for content, then **`tune`** with edited `markdown_doc` (one layer or multiple URIs).

When running **MCP-only** workflow tests (no shell, no filesystem except `reports/`), use only the MCP-only protocols above or protocols you train that contain no shell step.

## Reference

- **[Challenge types](challenge-types.md)** — Table of trainable example docs, how to train, and solution shapes for `forward`.

## Related docs

- [Architecture and protocol workflows](../architecture/README.md) — End-to-end flow (**activate** → **forward** → **reward**) and per-tool workflows.
- [Workflow test README](../../tests/workflow-test/README.md) — Test harness and how to run.
- Building KAIROS workflows is described in the MCP resource **building-kairos-workflows** and in the tool description for **`train`**.
- [Agent-facing design principles](../../CONTRIBUTING.md#agent-facing-design-principles) — For contributors designing or reviewing MCP tools and APIs.

