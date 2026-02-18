# Architecture and protocol workflows

This section describes how the KAIROS protocol works end-to-end and how each
MCP tool fits into the flow. Use it when implementing clients, debugging
execution, or designing new agent-facing behavior.

## What you will find here

- **Full execution:** A single walkthrough from search to attest with example
  requests and responses.
- **Tool workflows:** Per-tool response shapes, scenarios, and AI decision
  rules for `kairos_search`, `kairos_begin`, `kairos_next`, and
  `kairos_attest`.

Protocol order is always: search → begin → next (loop) → attest.

## Full execution walkthrough

[Full execution workflow: search to attest](workflow-full-execution.md) shows
one complete run of a 3-step protocol. It includes raw JSON for each call and
how `next_action` chains the flow.

## Tool workflow reference

| Tool                                       | Purpose                                                    |
| ------------------------------------------ | ---------------------------------------------------------- |
| [kairos_search](workflow-kairos-search.md) | Find protocols by query; get `choices` and `next_action`.  |
| [kairos_begin](workflow-kairos-begin.md)   | Load step 1 and first challenge; no solution required.     |
| [kairos_next](workflow-kairos-next.md)     | Submit a solution and receive the next step or completion. |
| [kairos_attest](workflow-kairos-attest.md) | Finalize the run with outcome and message; update metrics. |
| [quality_metadata](quality-metadata.md) | How we use quality_metadata in Qdrant payloads; JSON examples and data flow. |

Read the tool docs in that order when tracing a full run or implementing a
client.

## Next steps

- For the project’s mission and strategy, see the
  [Charter](../../CHARTER.md).
- For CLI usage, see [CLI](../CLI.md).
- For Cursor setup, see [Install KAIROS MCP in Cursor](../INSTALL-MCP.md).
- For agent-facing design doctrine, see
  [Agent-facing design principles](../../CHARTER.md#agent-facing-design-principles).
