# Example: All challenge types

One protocol with four steps, one per challenge type (shell, mcp, user_input, comment). Ready to mint with `kairos_mint`.

## Step 1 — Run a command

Run the given shell command. Exit code 0 means success.

```json
{
  "challenge": {
    "type": "shell",
    "shell": {
      "cmd": "echo OK",
      "timeout_seconds": 10
    },
    "required": true
  }
}
```

## Step 2 — Call an MCP tool

Call the `kairos_search` tool with any query and report success.

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

## Step 3 — Get user confirmation

Obtain explicit approval from the user before continuing.

```json
{
  "challenge": {
    "type": "user_input",
    "user_input": {
      "prompt": "Proceed to the next step?"
    },
    "required": true
  }
}
```

## Step 4 — Provide a verification comment

Write a short summary of what was done in this protocol (at least 30 characters).

```json
{
  "challenge": {
    "type": "comment",
    "comment": {
      "min_length": 30
    },
    "required": true
  }
}
```

## Step 5 — Run complete

Only reachable after Steps 1–4 are solved. Show the outputs from Steps 1–4 to the user (command result, MCP result, user confirmation, summary). No additional challenge.
