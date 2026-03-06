Start protocol execution. Loads step 1 and returns its challenge.
Step 1 never requires a solution submission.

**Precondition:** You have a URI from `kairos_search` (via a choice's
`next_action`). Do not call with a URI you invented.

**Input:** `uri` — the protocol URI from `next_action`. If you supply a
non-step-1 URI, KAIROS auto-redirects to step 1.

**Response:** `current_step` (content + uri), `challenge` (type,
description, nonce, proof_hash), `next_action` with the exact URI for
the next call. Always `must_obey: true`.

**AI decision tree:**

- `next_action` mentions `kairos_next`: execute the challenge, then call
  `kairos_next` with the URI from `next_action` and a solution matching
  the challenge type.
- `next_action` directs you to `kairos_attest`: single-step protocol.
  Call `kairos_attest` with the given URI and outcome/message; run is
  done.

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

**Proof hash:** Echo `challenge.proof_hash` as `solution.proof_hash` in
the next `kairos_next` call. The server generates all hashes.

**MUST ALWAYS**

- Perform the actual challenge work before submitting the solution.
- Echo `challenge.nonce` and `challenge.proof_hash` verbatim in the
  next `kairos_next` call.

**MUST NEVER**

- Compute or modify hashes or nonces.
- Call `kairos_begin` again on error — use the fresh challenge in the
  error response to retry via `kairos_next`.
