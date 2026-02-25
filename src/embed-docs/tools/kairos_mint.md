Stores markdown documents as KAIROS memories with automatic header-based organization. Each H1 defines a protocol chain; each H2 defines a step.

**When to call:** When the user wants to create, add, mint, store, or save a protocol or document.

**Challenge:** For each step that can be verified, add a fenced ` ```json ` block at the end with an object that has a `challenge` key. The value is the same shape as the `challenge` returned by kairos_begin/kairos_next; round-trips with kairos_dump.

**Challenge examples (one per type; use a ` ```json ` code block at the end of each step):**

**shell** — run a command:

```json
{
  "challenge": {
    "type": "shell",
    "shell": {
      "cmd": "npm test",
      "timeout_seconds": 60
    },
    "required": true
  }
}
```

**comment** — verification text (min length):

```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

**user_input** — human confirmation:

```json
{
  "challenge": {
    "type": "user_input",
    "user_input": { "prompt": "Approve deployment?" },
    "required": true
  }
}
```

**mcp** — call MCP tool:

```json
{
  "challenge": {
    "type": "mcp",
    "mcp": { "tool_name": "kairos_mint" },
    "required": true
  }
}
```

Use a challenge on every step that can be verified: commands → shell; reviews/summaries → comment; approvals → user_input; tool calls → mcp. Mix types in one protocol. See workflow-kairos-mint and the creation protocol (kairos://mem/00000000-0000-0000-0000-000000002001) for full examples.

**Input:** `markdown_doc` (string), `llm_model_id` (required), `force_update` (optional, overwrite existing chain with same label).

**Response:** Chain head URI(s). You can then find the protocol via `kairos_search` with a query matching the content.
