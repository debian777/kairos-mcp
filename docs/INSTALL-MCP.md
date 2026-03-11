# Install KAIROS MCP in Cursor

**Agent skill:** Install the [KAIROS agent skill](../README.md#agent-skill) and ask your agent to run KAIROS protocols; for MCP config the agent can help or use this section. This section is for manual configuration.

This guide shows you how to connect KAIROS to Cursor as an MCP server. Once
connected, Cursor can call KAIROS tools automatically without prompting for
each one.

You need a KAIROS server running at a URL you control before you add the
config. See the [README](../README.md) for the Docker quick start.

## Add the MCP server

1. Start your KAIROS server and note its URL (for example,
   `http://localhost:3000`).

2. Click the install button to open Cursor with the config pre-filled, or
   copy the JSON block manually into your Cursor MCP settings.

   [![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=KAIROS&config=eyJ0eXBlIjoic3RyZWFtYWJsZS1odHRwIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL21jcCIsImFsd2F5c0FsbG93IjpbImthaXJvc19iZWdpbiIsImthaXJvc19uZXh0Iiwia2Fpcm9zX21pbnQiLCJrYWlyb3NfYXR0ZXN0Iiwia2Fpcm9zX3VwZGF0ZSIsImthaXJvc19kZWxldGUiXX0%3D)

   **Manual config (use this for the full tool list):**

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

   Change `url` to match your server's address if it differs from
   `http://localhost:3000`. The `alwaysAllow` list lets Cursor run these
   tools without asking for confirmation each time.

3. Save the config, then reload Cursor or restart the MCP connection.

## Troubleshooting

**Cursor shows "MCP server not connected."** Confirm the KAIROS server is
running. Run `curl http://localhost:3000/health` to verify. If that fails,
check the Docker logs with `docker compose -p kairos-mcp logs app-prod`.

**Tools are not auto-running.** The one-click install button omits
`kairos_search` from `alwaysAllow`. Use the manual config above to include
all seven tools.

**The server connects but returns errors.** Check the KAIROS server logs for
embedding provider or Qdrant connectivity errors. A missing
`OPENAI_API_KEY` is the most common cause.
