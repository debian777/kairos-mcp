# Install KAIROS MCP in Cursor

This guide shows you how to connect KAIROS to Cursor as an MCP server. Once
connected, Cursor can call KAIROS tools automatically without prompting for
each one.

You need a KAIROS server running at a URL you control before you add the
config. See the [README](../README.md) for the Docker quick start.

## The easy way: Add to Cursor (one-click)

Click the button below. Cursor opens with the server name, transport, and URL
already filled in. Click **Install** and you’re done.

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=KAIROS&config=eyJ0eXBlIjoic3RyZWFtYWJsZS1odHRwIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL21jcCIsImFsd2F5c0FsbG93IjpbImthaXJvc19zZWFyY2giLCJrYWlyb3NfYmVnaW4iLCJrYWlyb3NfbmV4dCIsImthaXJvc19taW50Iiwia2Fpcm9zX2F0dGVzdCIsImthaXJvc191cGRhdGUiLCJrYWlyb3NfZGVsZXRlIl19)

The link assumes KAIROS is at `http://localhost:3000`. If your server uses a
different URL, use the manual config below and change the `url` value.

## Manual config

Copy this JSON into your Cursor MCP settings (e.g. **Settings → MCP → Edit
config**) if you prefer to edit the URL or tool list by hand:

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

Change the `url` value if your KAIROS server is not at `http://localhost:3000`.
The `alwaysAllow` list lets Cursor run these tools without asking for
confirmation each time. Save the config, then reload Cursor or restart the MCP
connection.

## Troubleshooting

**Cursor shows "MCP server not connected."** Confirm the KAIROS server is
running. Run `curl http://localhost:3000/health` to verify. If that fails,
check the Docker logs with `docker compose -p kairos-mcp logs app-prod`.

**Tools are not auto-running.** Add the KAIROS tools to `alwaysAllow` in the
manual config so Cursor can run them without asking each time.

**The server connects but returns errors.** Check the KAIROS server logs for
embedding provider or Qdrant connectivity errors. A missing
`OPENAI_API_KEY` is the most common cause.
