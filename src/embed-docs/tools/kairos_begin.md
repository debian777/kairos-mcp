Start protocol execution. Loads step 1 and returns its challenge. Step 1 never requires a solution.

**When to call:** After `kairos_search` returns a URI in `next_action`. Call with that URI to begin the protocol. If a non-step-1 URI is provided, KAIROS auto-redirects to step 1.

**Response:** `current_step` (content + uri), `challenge` (type, description, nonce, proof_hash), and `next_action` with the exact URI for the next call.

**Execution rules by challenge.type:** You must perform the challenge, not infer it. shell: Run `challenge.shell.cmd` and report the actual exit_code/stdout/stderr; never fabricate. mcp: Call `challenge.mcp.tool_name` and report the actual result; success must reflect reality. user_input: **Handled server-side via MCP client elicitation.** The server will automatically request user confirmation; the agent does not need to (and cannot) handle user_input steps. comment: Write a genuine, relevant comment that meets `challenge.comment.min_length`.

**AI decision tree:** `must_obey: true` -> follow `next_action`.

- If `next_action` mentions `kairos_next`: Execute the challenge, then call `kairos_next` with the URI from `next_action` and a solution matching the challenge.
- If `next_action` directs you to call kairos_attest: Single-step (or no further steps). Call kairos_attest with the given URI and outcome/message; then run is done.

**Proof hash:** Echo `challenge.proof_hash` back as `solution.proof_hash` in the next `kairos_next` call. The server generates all hashes; the AI never computes them.
