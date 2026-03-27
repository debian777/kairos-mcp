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

## Install modes

You can connect in two ways:

1. **Manual MCP JSON** — add a streamable HTTP server under `mcpServers` in
   Cursor (see [Manual config](#manual-config)). This does not use Cursor plugin
   packaging; the small icon next to a tool run is usually generic host chrome.
2. **Local Cursor plugin** — install the bundled plugin under
   `integrations/cursor/plugin` (see [Cursor plugin bundle](#cursor-plugin-bundle-branded-tool-row)).
   The manifest includes a `logo` path so Cursor can show KAIROS branding on
   the tool row while requests still go to the same HTTP MCP URL you configure.

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

## Cursor plugin bundle (branded tool row)

For a **plugin-packaged** install with a manifest `logo`, use the directory
`integrations/cursor/plugin` in this repository. It contains:

- `.cursor-plugin/plugin.json` — plugin metadata and `logo: "assets/logo.svg"`
- `assets/logo.svg` — same artwork as `logo/kaiiros-mcp.svg`
- `mcp/mcp.json` — `mcpServers` block (defaults to `http://localhost:3300/mcp`,
  matching the common local dev port in `.cursor/mcp.json` examples in this
  repo)

Point Cursor at that folder per [Cursor plugin
building](https://cursor.com/docs/plugins/building). Edit `mcp/mcp.json` if
your server URL or port differs. Step-by-step notes live in
`integrations/cursor/plugin/README.md`.

## In-chat widgets (MCP Apps) and alternate HTML profile

Supported MCP chat hosts can render **HTML widgets** for tool results instead of
plain JSON only. KAIROS registers widgets for **`spaces`** and **`forward`**.

**`spaces`**

- Primary: `ui://kairos/spaces-result` — MIME type `text/html;profile=mcp-app`
  (MCP Apps / SEP-1865 style).
- Alternate: `ui://open-ai/kairos/spaces-result` — MIME type
  `text/html+skybridge` for hosts that expect the Skybridge-style profile.

**`forward`**

- Primary: `ui://kairos/forward-result` — `text/html;profile=mcp-app`.
- Alternate: `ui://open-ai/kairos/forward-result` — `text/html+skybridge`.

**Discovery:** Hosts that call `listOfferingsForUI` receive UI resource entries
for all four URIs above, plus tool metadata (`_meta.ui.resourceUri`) on
`spaces` and `forward` pointing at each primary URI.

**Theming:** Widgets apply MCP Apps `hostContext` when the host provides it; they
also style `html.dark` for simple class-based dark surfaces.

## Demonstrating widgets with DEVELOPMENT_KAIROS

Use your **real** MCP connection and tools (no mocks). This repository’s Cursor
example names the server **`DEVELOPMENT_KAIROS`** and points at local dev MCP
(for example `http://localhost:3300/mcp` in `.cursor/mcp.json`). Your URL must
match wherever the app listens (Docker quick start often uses port **3000**;
`npm run dev:deploy` in this repo typically uses **3300** — check
`curl …/health` on the base URL you configured).

1. **Start the server** and confirm health on that base URL.
2. **Connect Cursor** (or another MCP Apps-capable client) using the same URL.
   The connector display name can be anything; the example here is
   **`DEVELOPMENT_KAIROS`**.
3. **Spaces widget:** Run the MCP tool **`spaces`**. Use `{}` or
   `{"include_adapter_titles": true}` if you want adapter titles in the payload.
   A capable host loads `ui://kairos/spaces-result` (or the Skybridge URI) and
   renders the branded table.
4. **Forward widget:** Run **`activate`** with a non-empty `query` (and optional
   `space` name if you scope activation). Pick a **`match`** choice from the
   response, then run **`forward`** with `{"uri": "<that choice’s adapter uri>"}`
   and no `solution` on the first call. The host should render
   `ui://kairos/forward-result` with **KAIROS • Protocol:** and adapter title in
   the header, **Running step:** plus `current_layer_label` in the panel, and
   step index / total plus outlined progress segments in the footer from the
   structured result.

If the host only shows JSON, it may not implement MCP Apps HTML resources yet;
the same calls still return full structured content on the wire.

## Tool row icon in Cursor

The small logo next to a tool run in chat is **host chrome** (Cursor or a
bundled MCP plugin), not something the streamable HTTP MCP wire defines. A plain
user `mcp.json` entry usually does not add a custom icon. To get the KAIROS mark
on the tool row, install the **local Cursor plugin** under
`integrations/cursor/plugin` (see [Cursor plugin bundle](#cursor-plugin-bundle-branded-tool-row)).
You can still reuse `logo/kaiiros-mcp.svg` in your own connector assets or docs
if you maintain a custom package.

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
