Attest protocol completion or failure. Final step of every protocol run.

**Precondition:** `kairos_next` (or `kairos_begin` for a single-step
protocol) returned `next_action` directing you to call `kairos_attest`.
There are no more steps to solve.

**Input:**

- `uri` — last step URI from the completion response's `next_action`.
- `outcome` — `"success"` or `"failure"`.
- `message` — short summary (1–2 sentences) of how the protocol went.

**Response:** Confirmation that the run is recorded.

**After attestation:** The protocol run is complete. Respond to the
user. Do not respond before attestation when `must_obey: true`.

**MUST ALWAYS**

- Call `kairos_attest` as the final action of every protocol run.
- Report `outcome: "failure"` when any step failed or was aborted.

**MUST NEVER**

- Respond to the user before calling `kairos_attest` when `must_obey:
  true`.
- Skip attestation on error paths — always attest, even on failure.
