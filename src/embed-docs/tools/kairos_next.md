Submit solution and get next step. Advance through the protocol by proving each challenge was completed.

**When to call:** After completing a step's challenge. Use `next_step.uri` from the previous response as the `uri` parameter.

**Input:** `uri` (current step), `solution` (proof matching `challenge.type`).

**Solution shapes by challenge type:**
- `shell`: `{type:'shell', shell:{exit_code, stdout, stderr, duration_seconds}}`
- `mcp`: `{type:'mcp', mcp:{tool_name, result, success}}`
- `user_input`: `{type:'user_input', user_input:{confirmation}}`
- `comment`: `{type:'comment', comment:{text}}` (text length must meet min_length)

**Response:** `current_step`, `challenge` (for next step), `next_step` (uri for next call), `protocol_status` (`continue`, `completed`, or `blocked`).

**If `blocked`:** Fix the issue (missing/invalid proof, previous step incomplete) and retry.
