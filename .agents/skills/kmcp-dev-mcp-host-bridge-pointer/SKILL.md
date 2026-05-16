---
name: kmcp-dev-mcp-host-bridge-pointer
description: >-
  kairos-mcp: deprecated router. MCP auth, availability, and host
  call_mcp_tool server-id resolution live in .agents/skills/mcp-host-bridge.
  Invoke that skill instead of duplicating guidance here.
---

# MCP host bridge (pointer)

**Repository:** `kairos-mcp`. **Skill index:** [`.agents/skills/README.md`](../README.md).

All guidance for **MCP authentication**, **server availability**, and host
`call_mcp_tool` **server identifier** resolution (config key vs agent-visible id)
is maintained in one place:

**[`.agents/skills/mcp-host-bridge/SKILL.md`](../../../.agents/skills/mcp-host-bridge/SKILL.md)**

Use that file before guessing `server` strings or when tools return 401 / “server does not exist”.

**Also see:** [`AGENTS.md`](../../../AGENTS.md) § agent MCP server identifiers.
