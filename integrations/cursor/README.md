# Cursor integration

Layout:

| Path | Role |
|------|------|
| `plugin/` | **Install this directory** as a Cursor local plugin (contains `.cursor-plugin/`, `assets/`, and `mcp/`). |
| `plugin/mcp/mcp.json` | MCP server definitions for Cursor (`mcpServers` in the manifest points here). |

Cursor’s plugin checklist requires manifest paths **without `..`**, so `mcp.json` lives **under** the plugin root as `mcp/mcp.json`, not as a sibling of `plugin/` at `integrations/cursor/mcp/` (that would need `../mcp/mcp.json` in the manifest).

See `plugin/README.md` for symlink path and marketplace notes.
