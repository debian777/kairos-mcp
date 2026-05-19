Run an **adapter** layer by layer.

First call (start a run):

```json
{ "uri": "kairos://adapter/<slug>" }
```

Copy this from `activate.choices[].forward_first_call.uri`. Adapter URIs are
slug-only on the wire.

Continuation call:

```json
{
  "uri": "kairos://layer/<uuid>?execution_id=<uuid>",
  "solution": {
    "type": "<contract.type>",
    "outcome": "success",
    "evidence": { /* type-specific proof data */ },
    "nonce": "<contract.nonce when present>",
    "proof_hash": "<contract.proof_hash when present>"
  }
}
```

Copy `forward.next_call.args` from the previous response, then fill the
`solution.evidence` payload. Layer URIs are UUID-only; never substitute a slug
for a layer URI.

Output always includes:

- `contract` for the current layer
- `next_action` prose guidance
- `next_call` (authoritative machine-readable next call)

`next_call.kind` is:

- `forward` on non-terminal layers
- `reward` on terminal layers

## Unified solution envelope (v2 format)

Every solution, regardless of type, follows the same envelope:

```json
{
  "type": "<challenge_type>",
  "outcome": "success | failure | skipped",
  "evidence": { "/* type-specific proof */": true },
  "nonce": "<echo from contract>",
  "proof_hash": "<echo from contract>"
}
```

### Per-type `evidence` shapes

#### shell

```json
{
  "type": "shell",
  "outcome": "success",
  "evidence": {
    "exit_code": 0,
    "stdout": "...",
    "stderr": "",
    "duration_seconds": 1.2
  }
}
```

#### mcp

```json
{
  "type": "mcp",
  "outcome": "success",
  "evidence": {
    "tool_name": "editJiraIssue",
    "arguments": { "issueIdOrKey": "BIB-1383" },
    "response": { "key": "BIB-1383", "webUrl": "..." }
  }
}
```

#### comment

```json
{
  "type": "comment",
  "outcome": "success",
  "evidence": {
    "text": "Verified all 78 issues now have repo: labels."
  }
}
```

#### user_input

```json
{
  "type": "user_input",
  "outcome": "success",
  "evidence": {
    "confirmation": "agreed. proceed",
    "timestamp": "2026-05-18T14:49:00Z"
  }
}
```

#### tensor

```json
{
  "type": "tensor",
  "outcome": "success",
  "evidence": {
    "name": "priority_score",
    "value": [0.85, 0.72, 0.91]
  }
}
```

## Format migration and compatibility

The server accepts both old (v1) and new (v2) formats silently:

### Old (v1) — accepted forever, never advertised

```json
{
  "type": "mcp",
  "mcp": { "tool_name": "x", "result": {}, "success": true }
}
```

### New (v2) — advertised in error messages, docs, examples

```json
{
  "type": "mcp",
  "outcome": "success",
  "evidence": { "tool_name": "x", "response": {} }
}
```

### When to use v2 format

**Always prefer v2** for new protocols and solutions. Use v2 when:
- Creating new adapter protocols
- Submitting solutions to any challenge type
- Reading error messages (they show v2 examples)
- Following `next_action` guidance (it teaches v2 format)

### Key differences between v1 and v2

| Aspect | v1 (older) | v2 (unified) |
|--------|-------------|--------------|
| **Structure** | `{type, [type]: {...}}` | `{type, outcome, evidence: {...}}` |
| **Success signal** | `success: true` inside type object | `outcome: "success"` at top level |
| **MCP response** | `result` field | `response` field inside evidence |
| **Consistency** | Different shapes per type | Unified envelope for all types |

### Automatic format conversion

The server automatically converts v1 to v2 internally:
- v1 `mcp.result` becomes v2 `evidence.response`
- v1 `mcp.success` is derived from v2 `outcome` if not provided
- Older type-specific objects are wrapped in `evidence` envelope

### Mixed format protocols

You can safely mix v1 and v2 solutions within the same protocol run. The server handles both formats seamlessly:

```json
// Step 1: v1 format (still accepted)
{"type": "shell", "shell": {"exit_code": 0, "stdout": "done"}}

// Step 2: v2 format (preferred)
{"type": "mcp", "outcome": "success", "evidence": {"tool_name": "search", "response": {...}}}

// Step 3: v1 format (still works)
{"type": "comment", "comment": {"text": "verification complete"}}
```

All examples in this documentation use v2 format. Follow these examples for best results.
