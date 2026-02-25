# KAIROS MCP — Target architecture plans

This directory holds **goal-state** documentation: the architecture and workflows **after** kairos-mcp is extended with MCP client sampling. It does **not** describe how to implement or migrate; that will be a separate plan.

## Scope

- **In scope:** What the system looks like and how it behaves when the sampling integration is done. New components, data flows, and workflows.
- **Out of scope:** Implementation steps, file-level refactors, migration from current behaviour. Current behaviour remains documented in [../architecture/](../architecture/).

## Documents


| Document                                                                     | Description                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [01-target-architecture.md](01-target-architecture.md)                       | New architecture: KAIROS server, MCP client, sampling API, challenge prompts, validation. Components and data flow.          |
| [02-workflow-sampling.md](02-workflow-sampling.md)                           | Sampling workflow: server requests LLM via client; client runs and returns; server validates. Approval modes (auto vs user). |
| [03-workflow-protocol-run.md](03-workflow-protocol-run.md)                   | Full protocol run with sampling: search → begin → solve step via sampling → next (loop) → attest. Before/after contrast.     |
| [04-session-handover.md](04-session-handover.md)                             | Session handover file format and how it enables resumability across client restarts or switches.                             |
| [05-challenge-prompts-and-policies.md](05-challenge-prompts-and-policies.md) | Challenge types to sampling prompts; which steps use auto vs user approval; client policies.                                 |


## Reference

- Source of the target vision: [../../cache/experimental-mcp.md](../../cache/experimental-mcp.md).
- Current protocol and tool workflows: [../architecture/README.md](../architecture/README.md).

## MCP specification and sampling

- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Client sampling](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — servers request LLM calls through clients; prompts and approval modes.
- For up-to-date library/docs: use **Context7** with query “modelcontextprotocol sampling”.

