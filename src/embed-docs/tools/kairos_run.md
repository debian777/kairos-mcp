Start a KAIROS run from the user's raw message. **Canonical natural-language
entrypoint:** pass the user's message; the server searches and either begins
the best-matching protocol or the refine protocol. Then follow `next_action`
(kairos_next loop, then kairos_attest).

**When to use:** Call this tool whenever the user's message describes an
action, task, workflow, or procedure — even if they do not mention KAIROS,
protocols, or tools. The user's natural language is the input.

**Input:**

- `message` — the user's message or a short intent phrase. Stay faithful to
  their intent.
- `space` (optional) — scope to this space (must be in your allowed spaces).
- `space_id` (optional) — alias for space.

**Response:** Same shape as `kairos_begin` (must_obey, current_step, challenge,
next_action, optional message) plus a `routing` object:

- `routing.decision` — `direct_match` (one strong match), `refine_no_match`,
  `refine_weak_match`, or `refine_ambiguous`.
- `routing.selected_uri`, `routing.selected_label`, `routing.selected_role`,
  `routing.selected_score`, `routing.protocol_version` — what was chosen.

**After kairos_run:** Follow `next_action` exactly. If it directs you to
`kairos_next`, run the challenge, submit the solution, then repeat until
`next_action` directs you to `kairos_attest`. Complete `kairos_attest` before
responding to the user.

**MUST ALWAYS**

- Use the URI from `next_action` for the next call (kairos_next or
  kairos_attest).
- Echo `challenge.nonce` and `challenge.proof_hash` in solutions.
- Complete `kairos_attest` before responding to the user.

**MUST NEVER**

- Compute hashes or nonces; the server generates them.
- Respond to the user before `kairos_attest` when `must_obey: true`.
