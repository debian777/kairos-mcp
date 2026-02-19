# KAIROS challenge types

Each protocol step can define a **challenge** (what must be done). The agent completes the work and submits a **solution** via `kairos_next`. The solution shape must match the challenge type. This document describes all four types in human-readable form.

When **minting** a protocol with `kairos_mint`, add a trailing ` ```json ` block at the end of the step body with an object `{"challenge": { ... }}`. The server returns the same challenge shape from `kairos_begin` / `kairos_next` so the agent knows what to prove.

---

## 1. Shell

**Purpose:** Verify that a shell command was run. Use for build steps, tests, file operations, or any CLI proof.

**Challenge definition (in step body):**

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

- `shell.cmd` — The command the agent must run (e.g. `npm test`, `mkdir -p project/src`).
- `shell.timeout_seconds` — Max time in seconds before the run is considered failed (defaults apply if omitted).

**Step body example:**

```markdown
## Run tests

Execute the test suite for the project.

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
```

**Solution shape (what the agent sends in `kairos_next`):**

- `type`: `"shell"`
- `shell.exit_code` — Exit code of the command (0 = success).
- `shell.stdout` (optional) — Standard output.
- `shell.stderr` (optional) — Standard error.
- `shell.duration_seconds` (optional) — How long the command took.

Include `nonce` and `proof_hash` when the challenge includes them (echo back from the server).

**Validation rules:** The server accepts the proof if `exit_code === 0`. Non-zero exit code is treated as failure; the agent can retry (subject to retry limits).

---

## 2. MCP

**Purpose:** Verify that an MCP tool was called successfully. Use when a step requires the agent to invoke a specific tool (e.g. `kairos_mint`, a file tool) and report the result.

**Challenge definition (in step body):**

```json
{
  "challenge": {
    "type": "mcp",
    "mcp": {
      "tool_name": "kairos_mint"
    },
    "required": true
  }
}
```

- `mcp.tool_name` — Name of the MCP tool the agent must call.
- `mcp.expected_result` (optional) — Optional hint or expected shape; validation is primarily via `success`.

**Step body example:**

```markdown
## Mint the protocol

Call the `kairos_mint` tool to store this protocol in KAIROS.

```json
{
  "challenge": {
    "type": "mcp",
    "mcp": {
      "tool_name": "kairos_mint"
    },
    "required": true
  }
}
```
```

**Solution shape (what the agent sends in `kairos_next`):**

- `type`: `"mcp"`
- `mcp.tool_name` — Name of the tool that was called.
- `mcp.result` — The result returned by the tool (opaque to the server).
- `mcp.success` — Must be `true` for the proof to pass.
- `mcp.arguments` (optional) — Arguments passed to the tool.

Include `nonce` and `proof_hash` when present in the challenge.

**Validation rules:** The server accepts the proof if `mcp.success === true`. If `success` is false or the type-specific fields are missing, the proof fails.

---

## 3. User input

**Purpose:** Require explicit human confirmation before advancing. Use for approvals, go/no-go gates, or any step that must not proceed without a human saying so.

**Challenge definition (in step body):**

```json
{
  "challenge": {
    "type": "user_input",
    "user_input": {
      "prompt": "Approve deployment to production?"
    },
    "required": true
  }
}
```

- `user_input.prompt` (optional) — Text shown to the user (e.g. "Approve deployment?"). Can be omitted for a generic "Confirm completion" style prompt.

**Step body example:**

```markdown
## Confirm deployment

Get explicit approval from the user before deploying.

```json
{
  "challenge": {
    "type": "user_input",
    "user_input": {
      "prompt": "Approve deployment to production?"
    },
    "required": true
  }
}
```
```

**Solution shape (what the agent sends in `kairos_next`):**

- `type`: `"user_input"`
- `user_input.confirmation` — The user’s confirmation text (e.g. "yes", "approved"). The server does not interpret the content; presence of a confirmation indicates the user responded.
- `user_input.timestamp` (optional) — When the user confirmed (e.g. ISO 8601).

Include `nonce` and `proof_hash` when present in the challenge.

**Validation rules:** The server accepts the proof when the agent supplies `user_input.confirmation`. The agent must obtain this from the user (e.g. via chat or a dedicated prompt); the server does not collect input itself.

---

## 4. Comment

**Purpose:** Verify that the agent provided a verification comment or summary (e.g. a short description of what was done, or a review summary). Use for steps where the “proof” is text that meets a minimum length and, optionally, is checked for relevance to the step.

**Challenge definition (in step body):**

```json
{
  "challenge": {
    "type": "comment",
    "comment": {
      "min_length": 50
    },
    "required": true
  }
}
```

- `comment.min_length` (optional) — Minimum number of characters the comment must have (defaults to a small value if omitted, e.g. 10).

**Step body example:**

```markdown
## Summarize changes

Provide a short summary of the changes made (at least 50 characters).

```json
{
  "challenge": {
    "type": "comment",
    "comment": {
      "min_length": 50
    },
    "required": true
  }
}
```
```

**Solution shape (what the agent sends in `kairos_next`):**

- `type`: `"comment"`
- `comment.text` — The verification comment or summary. Must be at least `min_length` characters (from the challenge).

Include `nonce` and `proof_hash` when present in the challenge.

**Validation rules:**

- **Length:** `comment.text.length` must be ≥ the challenge’s `comment.min_length` (or the default).
- **Semantic check (optional):** The server may optionally check that the comment is semantically related to the step content (e.g. via embedding similarity). If that check is enabled and the comment is too unrelated, the proof can fail; otherwise length alone is sufficient.

---

## Summary table

| Type        | Use when…                    | Key challenge fields     | Key solution fields              | Pass condition              |
|------------|-------------------------------|---------------------------|----------------------------------|-----------------------------|
| **shell**  | A command must be run         | `shell.cmd`, `timeout_seconds` | `shell.exit_code`, stdout/stderr | `exit_code === 0`           |
| **mcp**    | An MCP tool must be called    | `mcp.tool_name`           | `mcp.tool_name`, `result`, `success` | `success === true`          |
| **user_input** | Human must confirm         | `user_input.prompt` (optional) | `user_input.confirmation`   | Agent supplies confirmation |
| **comment**   | Text proof (summary/comment) | `comment.min_length`      | `comment.text`                   | Length ≥ min_length (and optional similarity) |

## Echoing server-generated fields

The server often includes `nonce` and `proof_hash` in the challenge. The agent must echo these back in the solution:

- **nonce** — Copy `challenge.nonce` into `solution.nonce` (if present).
- **proof_hash** — For step 1, use `challenge.proof_hash` as `solution.proof_hash`. For step 2 and later, use the `proof_hash` returned in the previous `kairos_next` response. The server generates all hashes; the agent never computes them.
