# Integrations

Host- and vendor-specific packaging so KAIROS MCP plugs into particular AI
products (Cursor marketplace plugin layout, future hosts, and similar).

Server-side MCP Apps (`ui://` widgets) live under `src/mcp-apps/` in the main
package; this directory is only for **client-side** install bundles.

| Path | Purpose |
|------|---------|
| `cursor/` | Cursor integration: install the `plugin/` subdirectory as a local plugin (`mcp/mcp.json` lives inside it). |
| `claude/desktop/` | Claude Desktop: **`claude_desktop_config.json`** paths, KAIROS MCP example, and [skills/](claude/desktop/skills/) zips. |

See each subdirectory README for install and publish steps.
