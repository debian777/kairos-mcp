# Claude Desktop integration

## MCP — `claude_desktop_config.json`

Claude Desktop loads MCP servers from a JSON file. In the app, open **Settings →
Developer → Edit Config** to create or open it (paths below are the usual
locations).

| OS | Path |
|----|------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` (often `C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`) |

macOS shell examples (space in `Application Support`):

```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
# or
open -e "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

After editing, **fully quit** Claude Desktop and reopen so MCP settings reload.
Logs: macOS `~/Library/Logs/Claude` (see [MCP quickstart — troubleshooting](https://modelcontextprotocol.io/quickstart/user)).

### KAIROS entry

The same logical server definition as the Cursor plugin lives in this repo at
`integrations/cursor/plugin/mcp/mcp.json`. Merge the `mcpServers` object into
your `claude_desktop_config.json` (or paste the file if it only contains
`mcpServers`).

Example (adjust `url` and auth for your deployment; see [Install KAIROS MCP in Cursor](../../../docs/INSTALL-MCP.md) for streamable HTTP and OAuth):

```json
{
  "mcpServers": {
    "KAIROS": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "alwaysAllow": [
        "activate",
        "forward",
        "train",
        "reward",
        "tune",
        "delete",
        "export",
        "spaces"
      ]
    }
  }
}
```

The upstream [Model Context Protocol quickstart for Claude Desktop](https://modelcontextprotocol.io/quickstart/user) documents **stdio** (`command` / `args`) servers first. Support for **remote** transports (`url`, `type: streamable-http`, etc.) depends on your **Claude Desktop version**; if the app rejects this shape, use a version that documents remote MCP, or run a **stdio MCP proxy** in front of your HTTP endpoint until the client matches what you use in Cursor.

## Skills (.zip)

See **[skills/README.md](skills/README.md)** for release-built zips and local packaging.
