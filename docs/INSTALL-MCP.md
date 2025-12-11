[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=KAIROS&config=eyJ0eXBlIjoic3RyZWFtYWJsZS1odHRwIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL21jcCIsImFsd2F5c0FsbG93IjpbImthaXJvc19iZWdpbiIsImthaXJvc19uZXh0Iiwia2Fpcm9zX21pbnQiLCJrYWlyb3NfYXR0ZXN0Iiwia2Fpcm9zX3VwZGF0ZSIsImthaXJvc19kZWxldGUiXX0%3D)

```json
{
  "mcpServers": {
    "KAIROS": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "alwaysAllow": [
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
