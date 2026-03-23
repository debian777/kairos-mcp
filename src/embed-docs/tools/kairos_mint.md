Store a markdown document as a KAIROS protocol chain. Each H1 defines
a chain; each H2 defines a step.

**Precondition:** You have a complete markdown document with H1 title,
H2 steps, and at least one trailing ` ```json ` challenge block. Add a
challenge block to every step you want KAIROS to verify.

**Recommended:** For guided protocol creation, call `kairos_begin` with
`kairos://mem/00000000-0000-0000-0000-000000002001`. Direct minting
requires: `## Natural Language Triggers` (first H2), `## Completion Rule`
(last H2), and at least one challenge block.

**Optional YAML frontmatter** (before the H1) can set:

- `slug:` — exact routing key for `kairos_begin` with `key` (lowercase,
  letters, digits, hyphens only). Must be **unique per space**; mint
  fails with `DUPLICATE_SLUG` if another protocol already uses it.
- `version:` — same as `protocol_version` below.

If `slug` is omitted, it is **auto-generated** from the H1 title
(lowercase, hyphenated). If that collides with another protocol's slug,
the server appends `-2`, `-3`, … until unique.

**Input:**

- `markdown_doc` (string) — the markdown protocol document.
- `llm_model_id` (required) — e.g. `"minimax/minimax-m2:free"`.
- `force_update` (optional, default `false`) — set `true` to overwrite
  an existing chain with the same label.
- `protocol_version` (optional) — e.g. `"1.0.0"`. If provided, it
  overrides the frontmatter version. Otherwise the server uses the
  frontmatter version when present. Stored and exposed in
  `kairos_search` choices.
- `space` (optional) — target space name. Use `"personal"` (default) or
  a group name from `kairos_spaces`.

**Challenge block format:** Place a single trailing ` ```json ` block at
the end of each H2 step. The object must have a `challenge` key. Only
the last code block in a step is parsed as the challenge. **The opening
\`\`\`json must be at line start** (on its own line with no text before
it). Blocks with text on the same line (e.g. `Example: \`\`\`json`) are
not parsed as steps.

Add a challenge to every step that can be verified. Omit challenges only
for purely informational steps where no verification is possible.

**Challenge examples (one per type):**

`shell` — run a command (executor-side). Required: `cmd`, `timeout_seconds`.
Optional: `interpreter`, `flags`, `args`, `workdir` — see
`kairos_begin` for argv rules and silent execution.

Example: ```json
{
  "challenge": {
    "type": "shell",
    "shell": { "cmd": "npm test", "timeout_seconds": 60 },
    "required": true
  }
}
```

`comment` — verification text:

Example: ```json
{
  "challenge": {
    "type": "comment",
    "comment": { "min_length": 50 },
    "required": true
  }
}
```

`user_input` — human confirmation:

Example: ```json
{
  "challenge": {
    "type": "user_input",
    "user_input": { "prompt": "Approve deployment?" },
    "required": true
  }
}
```

`mcp` — call an MCP tool:

Example: ```json
{
  "challenge": {
    "type": "mcp",
    "mcp": { "tool_name": "kairos_mint" },
    "required": true
  }
}
```

**Response:** `items` array of stored memory URI(s), UUIDs, labels, and
tags. Find the minted protocol via `kairos_search` with a query matching
the document content.

**MUST ALWAYS**

- Pass `markdown_doc` as a string.
- Include `llm_model_id`.
- Include a `## Natural Language Triggers` section as the first H2 and a
  `## Completion Rule` section as the last H2.
- Use `force_update: true` when overwriting an existing chain with the
  same label.

**MUST NEVER**

- Pass `markdown_doc` as an object.
- Omit `llm_model_id`.
- Store duplicate chains without `force_update: true`.
