Submit a solution and advance to the next step. Use for every step
after step 1.

**Precondition:** You have completed the current step's challenge. You
have the URI from the previous response's `next_action`.

**Input:**

- `uri` — current step URI from `next_action` of the previous response.
  Do not use for step 1 — use `kairos_begin` for step 1.
- `solution` — proof matching `challenge.type`:
  - `shell`: `{ type: "shell", shell: { exit_code, stdout?, stderr?,
    duration_seconds? } }` — `exit_code: 0` = success.
  - `mcp`: `{ type: "mcp", mcp: { tool_name, result, success,
    arguments? } }` — `success` must be `true`.
  - `user_input`: `{ type: "user_input", user_input: { confirmation,
    timestamp? } }`.
  - `comment`: `{ type: "comment", comment: { text } }` — `text.length`
    must meet `challenge.comment.min_length`.
- `solution.nonce` — echo from `challenge.nonce` when present.
- `solution.proof_hash` — echo `challenge.proof_hash` for step 1; for
  steps 2+ echo the `proof_hash` from the previous `kairos_next`
  response. The server generates all hashes.

**Execution rules by `challenge.type`:**

- `shell`: Run `challenge.shell.cmd`. Report actual `exit_code`,
  `stdout`, `stderr`. Never fabricate.
- `mcp`: Call `challenge.mcp.tool_name`. Report actual result.
  `success` must reflect reality.
- `user_input`: Display `challenge.user_input.prompt` verbatim to the
  user. Place their exact reply in `user_input.confirmation`. Never
  invent it.
- `comment`: Write a genuine comment relevant to the step that meets
  `challenge.comment.min_length`.

**Response:** `current_step`, `challenge` (for next step), `next_action`
(next tool call with embedded URI), `proof_hash` (use as
`solution.proof_hash` for the next step).

**AI decision tree:**

- `must_obey: true` — follow `next_action` (success or recoverable
  error, retries 1–3).
- `must_obey: false` — use judgment (max retries exceeded). Options in
  `next_action`: fix the step via `kairos_update`, abort via
  `kairos_attest` with `outcome: "failure"`, or ask the user.
- `next_action` directs you to `kairos_attest` — call attest with the
  given URI and outcome/message; protocol run is done, then respond to
  the user.

**Error responses** include `error_code` (e.g. `NONCE_MISMATCH`,
`TYPE_MISMATCH`, `MAX_RETRIES_EXCEEDED`) and `retry_count`. A fresh
`challenge` with a new nonce is included for retry.

**MUST ALWAYS**

- Perform the actual challenge work before submitting.
- Use the URI from the previous `next_action`, not a stored or invented
  URI.
- Echo `nonce` and `proof_hash` verbatim from the correct source.

**MUST NEVER**

- Fabricate shell output, MCP results, or user confirmations.
- Compute or modify hashes or nonces.
- Re-call `kairos_begin` on error; retry using the error response's
  fresh challenge.
