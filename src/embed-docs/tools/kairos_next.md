Submit solution and get next step. Advance through the protocol by proving each challenge was completed.

**When to call:** After completing a step's challenge. Use `next_step.uri` from the previous `kairos_begin` or `kairos_next` response as the `uri` parameter. Do not use for step 1 — use `kairos_begin` for step 1.

**Input:** `uri` (current step URI), `solution` (proof matching the `challenge.type` returned for that step).

**Solution shapes by challenge type:**

- `shell`: `{type:'shell', shell:{exit_code, stdout?, stderr?, duration_seconds?}}` — exit_code 0 = success.
- `mcp`: `{type:'mcp', mcp:{tool_name, arguments?, result, success}}` — success must be true.
- `user_input`: `{type:'user_input', user_input:{confirmation, timestamp?}}`.
- `comment`: `{type:'comment', comment:{text}}` — text length must meet challenge's min_length.

**Response:** `current_step`, `challenge` (for next step), `next_step` (uri for next call), `protocol_status` (`continue`, `completed`, or `blocked`), `next_action` (what to do next).

**If `protocol_status === 'blocked':** Invalid or missing solution, or previous step's proof not completed. Fix and retry with correct solution.

**If `protocol_status === 'completed':** Call `kairos_attest(uri, outcome, message, final_solution)`; then you may respond to the user.
