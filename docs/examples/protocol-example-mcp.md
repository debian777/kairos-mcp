# Example: MCP challenge

Short protocol: one real step plus a final verification step. Requires the agent to call an MCP tool and report success. Ready to train with `train`.

## Natural Language Triggers

Run when user says "example mcp" or "mcp challenge".

## Step 1 — Call activate

Invoke the `activate` tool with a query and report the result. The solution must include `success: true`.

```json
{
  "contract": {
    "type": "mcp",
    "mcp": {
      "tool_name": "activate"
    },
    "required": true
  }
}
```

## Step 2 — Run complete

Only reachable after Step 1 is solved. Show the output from Step 1 to the user (tool name, query, and result). No additional challenge.

## Completion Rule

Only reachable after all prior steps are solved.
