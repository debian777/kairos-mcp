# Example: MCP challenge

Short protocol with one step. Requires the agent to call an MCP tool and report success. Ready to mint with `kairos_mint`.

## Step 1 — Call kairos_search

Invoke the `kairos_search` tool with a query and report the result. The solution must include `success: true`.

```json
{
  "challenge": {
    "type": "mcp",
    "mcp": {
      "tool_name": "kairos_search"
    },
    "required": true
  }
}
```
