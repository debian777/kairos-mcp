# Install KAIROS MCP in Cursor

This guide configures Cursor to use the KAIROS MCP server over HTTP.

Prerequisite: a running KAIROS server, for example from the Docker quick start
in the root [README](../README.md).

## Connection details

- transport: **streamable HTTP**
- default local MCP URL: `http://localhost:3000/mcp`
- unauthenticated discovery endpoint: `http://localhost:3000/.well-known/oauth-protected-resource`

If your server is running elsewhere, replace `http://localhost:3000` with your
actual base URL.

## One-click install

The following Cursor deeplink pre-fills a local HTTP MCP server (current tool
names):

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=KAIROS&config=eyJ0eXBlIjoic3RyZWFtYWJsZS1odHRwIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL21jcCIsImFsd2F5c0FsbG93IjpbImFjdGl2YXRlIiwiZm9yd2FyZCIsInRyYWluIiwicmV3YXJkIiwidHVuZSIsImRlbGV0ZSIsImV4cG9ydCIsInNwYWNlcyJdfQ)

## Manual config

Open **Settings → MCP → Edit config** in Cursor and add:

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

`alwaysAllow` is optional, but without it Cursor may prompt before running each
tool.

### MCP Apps (in-chat widget)

Hosts that implement MCP Apps (SEP-1865) can render a small **KAIROS-branded
HTML view** after the `spaces` tool runs. That surface is **server-controlled**
(iframe + `ui://kairos/spaces-result`); the **tool-row icon** in the host UI is
still **client-specific** and is not set by this protocol.

### Cursor integration (plugin bundle)

For Cursor’s plugin layout (manifest + `mcp.json`, optional marketplace
submission), see **`integrations/cursor/plugin/`** (copy that folder for local install) and its README.

### Reference: Atlassian MCP (logo vs MCP wire)

The public [Atlassian MCP Server](https://github.com/atlassian/atlassian-mcp-server)
plugin for Cursor uses:

- **Remote MCP URL** in `.mcp.json` (e.g. `https://mcp.atlassian.com/v1/mcp`; calls
  require OAuth — unauthenticated `initialize` returns `invalid_token`).
- **Logo in the Cursor UI** from the **Cursor plugin manifest** (`.cursor-plugin/plugin.json`
  field `logo` → `assets/logo.svg`), the same mechanism described in
  [Cursor’s plugins reference](https://cursor.com/docs/reference/plugins.md).

That tile/icon path is **not** part of MCP `initialize` or tool definitions. For
parity with how Atlassian appears in the marketplace and plugin list, ship a
logo via **`integrations/cursor/plugin/`** (or a published plugin), not only via MCP
Apps HTML inside chat.

## Auth-enabled servers

If `AUTH_ENABLED=true`, Cursor connects to the same `/mcp` URL, but the server
will require authentication. KAIROS exposes the standard protected-resource
metadata endpoint at:

```text
/.well-known/oauth-protected-resource
```

That metadata is what clients use to discover auth endpoints. Depending on your
Cursor version and setup, you may either:

- complete the authentication flow from Cursor, or
- authenticate with the KAIROS CLI first and reuse the shared local token/config

See [CLI auth](CLI.md#authentication) and
[authentication overview](architecture/auth-overview.md).

## Verify the connection

Before debugging Cursor, verify the server itself:

```bash
curl http://localhost:3000/health
```

Expected local endpoints:

- app health: `http://localhost:3000/health`
- MCP: `http://localhost:3000/mcp`
- UI: `http://localhost:3000/ui`

## Troubleshooting

### Cursor shows the server as disconnected

Check the app directly:

```bash
curl http://localhost:3000/health
docker compose -p kairos-mcp logs app-prod
```

If health fails, fix the server first.

### Cursor connects but tool calls fail

Common causes:

- Qdrant not reachable
- embedding backend not configured
- auth enabled but not completed

Inspect server logs and confirm the configured base URL matches the one you put
in Cursor.

### Tools are not auto-running

Make sure the tools you want are listed under `alwaysAllow`. The currently
registered tool set is:

- `activate`
- `forward`
- `train`
- `reward`
- `tune`
- `delete`
- `export`
- `spaces`
