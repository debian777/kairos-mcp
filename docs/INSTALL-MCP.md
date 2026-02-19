# Install KAIROS MCP in Cursor

This page describes how to add the KAIROS MCP server to Cursor. You need a
KAIROS server running locally (or at a URL you control) and Cursor with MCP
support. After you add the config, Cursor can call KAIROS tools without
prompting for the listed tools.

Follow these steps:

1. **Start the KAIROS server.** Ensure the server is running at the URL you
   will use in the config (for example, `http://localhost:3000`). See the
   project [README](../README.md) for quick start (Docker or developer option);
   see [CONTRIBUTING](../CONTRIBUTING.md) for full developer commands.

2. **Add the MCP config to Cursor.** Either use the one-click install link
   below (it opens Cursor with the config pre-filled) or copy the JSON block
   into your Cursor MCP settings.

3. **Reload Cursor or restart the MCP connection.** After saving the config,
   Cursor connects to KAIROS at the configured URL.

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=KAIROS&config=eyJ0eXBlIjoic3RyZWFtYWJsZS1odHRwIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL21jcCIsImFsd2F5c0FsbG93IjpbImthaXJvc19iZWdpbiIsImthaXJvc19uZXh0Iiwia2Fpcm9zX21pbnQiLCJrYWlyb3NfYXR0ZXN0Iiwia2Fpcm9zX3VwZGF0ZSIsImthaXJvc19kZWxldGUiXX0%3D)

**Config to paste (manual setup):**

```json
{
  "mcpServers": {
    "KAIROS": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "alwaysAllow": [
        "kairos_search",
        "kairos_begin",
        "kairos_next",
        "kairos_mint",
        "kairos_attest",
        "kairos_update",
        "kairos_delete"
      ]
    }
  }
}
```

> **Note:** The server must be running at the configured `url`. The `alwaysAllow`
> list lets Cursor run these KAIROS tools without asking for confirmation.

## Project override (dev container)

This repo includes a project-level MCP config at `.cursor/mcp.json`. It uses the
same server name **`KAIROS`** as the global config so that, when you open this
project, the project config overrides your user-wide `~/.cursor/mcp.json` for
this workspace. The project config points to `http://host.docker.internal:3000/mcp`
so that Cursor (or the agent) running inside a dev container can reach KAIROS
on the host. You do not need to change your global MCP settings; the project
wins for this repo.
