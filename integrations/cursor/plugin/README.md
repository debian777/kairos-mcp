# KAIROS MCP — Cursor plugin bundle

This folder is a **Cursor plugin** layout (manifest + `mcp/mcp.json`) for discover/install UX. It does not replace MCP Apps (`ui://` widgets); those are served by the KAIROS server.

## Local test

1. Copy or symlink **this directory** (`plugin/`) to `~/.cursor/plugins/local/kairos-mcp` (see [Cursor Plugins](https://cursor.com/docs/plugins)).
2. Edit `mcp/mcp.json` if your server is not at `http://localhost:3000/mcp`.
3. Reload Cursor; enable the **KAIROS** MCP server under Settings → MCP.

## Marketplace

To publish: follow [Submitting a plugin](https://cursor.com/docs/reference/plugins.md) and [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish). Listing review is Cursor-side; tile/icon use the committed `assets/kairos-mcp.svg` via the manifest `logo` field.

## Install deeplink

Generate a one-click install link from your real URL and tool allowlist: [MCP install links](https://cursor.com/docs/mcp/install-links.md). The main repo [INSTALL-MCP.md](../../../docs/INSTALL-MCP.md) includes an example deeplink for local dev.
