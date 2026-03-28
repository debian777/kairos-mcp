---
name: cursor-mcp-server-ids
description: "Resolve Cursor agent MCP `call_mcp_tool` server id vs `.cursor/mcp.json` keys (e.g. DEVELOPMENT_KAIROS → project-*-DEVELOPMENT_KAIROS). Use when the agent must call KAIROS MCP tools in Cursor and gets 'MCP server does not exist', or when documenting how to address local dev MCP."
---

# Cursor: agent MCP server id vs `mcp.json` key

## Problem

- **`.cursor/mcp.json`** names servers by key, e.g. **`DEVELOPMENT_KAIROS`**.
- Cursor’s **agent** `call_mcp_tool` expects a **different** `server` string.

## Pattern

Agent-visible ids are usually:

`project-<workspace-index>-<workspace-folder-slug>-<mcp.json-server-key>`

Example when this repo is the workspace root **`kairos-mcp`** and the key is **`DEVELOPMENT_KAIROS`**:

`project-0-kairos-mcp-DEVELOPMENT_KAIROS`

The numeric index and folder slug can change if the workspace path, multi-root layout, or Cursor version differs.

## What to do

1. On **“MCP server does not exist”**, use the **Available servers** list from the error (or Cursor MCP settings) and pick the server that matches your intent (e.g. ends with `-DEVELOPMENT_KAIROS` for local dev).
2. Do **not** hardcode one full string as the only valid id across clones or machines.

## Repo reference

See **AGENTS.md** § **Cursor agent MCP server identifiers**.
