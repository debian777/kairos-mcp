Start protocol execution. Loads step 1 and returns its challenge. Step 1 never requires a solution.

**When to call:** After `kairos_search` returns a URI in `next_action`. Call with that URI to begin the protocol. If a non-step-1 URI is provided, KAIROS auto-redirects to step 1.

**Response:** `current_step` (content + uri), `challenge` (type, description, nonce, proof_hash), and `next_action` with the exact URI for the next call.

**AI decision tree:** `must_obey: true` -> follow `next_action`.

- If `next_action` mentions `kairos_next`: Execute the challenge, then call `kairos_next` with the URI from `next_action` and a solution matching the challenge.
- If `next_action` says "Run complete.": Single-step protocol; run is done. You may respond to the user.

**Proof hash:** Echo `challenge.proof_hash` back as `solution.proof_hash` in the next `kairos_next` call. The server generates all hashes; the AI never computes them.
