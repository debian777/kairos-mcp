Submit solution and get next step. Advance through the protocol by proving each challenge was completed.

**When to call:** After completing a step's challenge. Use the URI from `next_action` of the previous response. Do not use for step 1 — use `kairos_begin` for step 1.

**Input:** `uri` (current step URI from `next_action`), `solution` (proof matching the `challenge.type`).

**Solution shapes by challenge type:**

- `shell`: `{type:'shell', shell:{exit_code, stdout?, stderr?, duration_seconds?}}` — exit_code 0 = success.
- `mcp`: `{type:'mcp', mcp:{tool_name, arguments?, result, success}}` — success must be true.
- `user_input`: `{type:'user_input', user_input:{confirmation, timestamp?}}`.
- `comment`: `{type:'comment', comment:{text}}` — text length must meet challenge's min_length.

Include in solution when the challenge has them: `nonce` (echo from challenge), `proof_hash` (echo `challenge.proof_hash` for step 1; for step 2+ use `proof_hash` from the previous `kairos_next` response). The server generates all hashes; the AI never computes them.

**Response:** `current_step`, `challenge` (for next step), `next_action` (next tool call with embedded URI), and `proof_hash` (hash of proof just stored — use as `solution.proof_hash` for the next step).

**AI decision tree:**
- `must_obey: true` -> follow `next_action` (success or recoverable error, retries 1-3).
- `must_obey: false` -> use judgment (max retries exceeded). Options in `next_action`: fix the step via `kairos_update`, abort via `kairos_attest` with failure, or ask the user.

**Error responses** include `error_code` (e.g., `NONCE_MISMATCH`, `TYPE_MISMATCH`, `MAX_RETRIES_EXCEEDED`) and `retry_count`. A fresh `challenge` with new nonce is provided for self-correction.

**When `next_action` says "Run complete.":** Protocol run is done; you may respond to the user.
