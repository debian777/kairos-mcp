# KAIROS Workflow After Phase 1

This document describes the workflow **after Phase 1** of the Simplify KAIROS Teaching Stack plan. The flow (search → begin → next → attest) is unchanged; teaching and one safeguard are improved.

---

## What Phase 1 changed

1. **Tool-centric teaching:** Enriched tool descriptions in `src/embed-docs/tools/*.md` (when to call, response shapes, `must_obey`, `next_action`). Schema fields have `.describe()` in tool registration.
2. **Short prompt:** The long contextual prompt was replaced with a brief intro; AGENTS.md is synced.
3. **Mem docs:** The two built-in mem docs were removed from boot; teaching is via tool descriptions and optional search results.
4. **Comment semantic validation:** For `comment` solutions, the backend now checks **embedding similarity** between the comment and the step content. If similarity is below threshold (e.g. 0.25), the solution is rejected with a message to engage with the step content.

The workflow diagram and step sequence are the same as in [workflow-original.md](workflow-original.md). Challenges and solutions still do **not** include nonce or previousProofHash (those come in Phase 2).

---

## Workflow (unchanged structure)

- **kairos_search** → Single match: `must_obey: true`, `start_here: uri`. Multiple: `choices`. Partial: `best_match`. No results: `no_protocol`.
- **kairos_begin(uri)** → Step 1: `current_step`, `challenge`, `protocol_status` (`continue` | `completed`). If continue → call kairos_next.
- **kairos_next(uri, solution)** → Validate solution; if valid, return next step or `completed` + `attest_required`. Invalid or missing proof → `blocked`.
- **kairos_attest(uri, outcome, message, final_solution)** → When `attest_required: true`; then protocol done.

---

## Proof of work after Phase 1

Challenge types are unchanged: **shell**, **mcp**, **user_input**, **comment**. What changes in Phase 1:

- **Comment:** After the length check, the backend computes an embedding of the submitted comment and of the step content, then cosine similarity. If similarity &lt; threshold → `protocol_status: 'blocked'` with message like: _"Comment does not appear relevant to this step. Please provide a response that engages with the step content."_

No nonce or previousProofHash yet; challenge/solution shapes are as in the original, except comments must be **relevant** to the step.

---

## Challenge / solution examples (Phase 1)

Same structure as original; comment solutions must now pass semantic validation.

### 1. Shell

**Challenge (example):**

```json
{
  "type": "shell",
  "description": "Execute shell command: mkdir -p src",
  "shell": { "cmd": "mkdir -p src", "timeout_seconds": 30 }
}
```

**Solution (success):**

```json
{
  "type": "shell",
  "shell": {
    "exit_code": 0,
    "stdout": "",
    "stderr": "",
    "duration_seconds": 0.1
  }
}
```

---

### 2. MCP

**Challenge (example):**

```json
{
  "type": "mcp",
  "description": "Call MCP tool: my_tool_name",
  "mcp": { "tool_name": "my_tool_name", "expected_result": null }
}
```

**Solution (success):**

```json
{
  "type": "mcp",
  "mcp": {
    "tool_name": "my_tool_name",
    "arguments": { "param": "value" },
    "result": { "ok": true },
    "success": true
  }
}
```

---

### 3. User input

**Challenge (example):**

```json
{
  "type": "user_input",
  "description": "User confirmation: Approve deployment?",
  "user_input": { "prompt": "Approve deployment?" }
}
```

**Solution:**

```json
{
  "type": "user_input",
  "user_input": {
    "confirmation": "yes",
    "timestamp": "2025-02-13T12:00:00.000Z"
  }
}
```

---

### 4. Comment (semantic validation in Phase 1)

**Challenge (example):**

```json
{
  "type": "comment",
  "description": "Provide a verification comment (minimum 20 characters)",
  "comment": { "min_length": 20 }
}
```

**Solution (accepted):** Text must be ≥ min_length **and** semantically relevant to the step (embedding similarity ≥ threshold).

```json
{
  "type": "comment",
  "comment": {
    "text": "I reviewed the security checklist and verified the three items: access control, encryption at rest, and audit logging."
  }
}
```

**Solution (rejected):** Generic or off-topic text may be blocked even if long enough.

```json
{
  "type": "comment",
  "comment": {
    "text": "I completed this step successfully and moved on."
  }
}
```

→ Backend may return `protocol_status: 'blocked'` with a message to engage with the step content.

---

## Summary (Phase 1)

| Type       | Challenge shape               | Solution shape         | Phase 1 change                     |
| ---------- | ----------------------------- | ---------------------- | ---------------------------------- |
| shell      | type, description, shell      | type, shell (...)      | —                                  |
| mcp        | type, description, mcp        | type, mcp (...)        | —                                  |
| user_input | type, description, user_input | type, user_input (...) | —                                  |
| comment    | type, description, comment    | type, comment (text)   | **Semantic relevance check** added |

Still no `nonce`, `genesis_hash`, or `previousProofHash`; those are added in Phase 2.
