Attest protocol completion or failure. Final step of every protocol run.

**Precondition:** `kairos_next` (or `kairos_begin` for a single-step
protocol) returned `next_action` directing you to call `kairos_attest`.
There are no more steps to solve.

**Input:**

- `uri` — last step URI from the completion response's `next_action`.
- `outcome` — `"success"` or `"failure"`.
- `message` — short summary (1–2 sentences) of how the protocol went.
- `quality_bonus` (optional) — additional quality bonus to apply.
- `llm_model_id` (optional) — model identifier for attribution.

**Response:** `results[]` with per-URI outcome details, plus
`total_rated` and `total_failed`. A successful tool call can still
include per-URI failures in this response.

**After attestation:** The protocol run is complete. Respond to the
user. Do not respond before attestation when `must_obey: true`.

**User-facing output rules:**

After calling `kairos_attest`, present a **single** summary to the user:

- What the protocol did (1–3 short bullet points).
- What changed (files, minted resources, tickets, etc.).
- Any follow-up actions still needed.

Do **not** replay individual step bodies, challenge JSON, shell command lines, or full execution traces — the user needs the **outcome**, not the log.

**Exception:** If the run failed, include the specific error and which step failed so the user can decide next steps.

**MUST ALWAYS**

- Call `kairos_attest` as the final action of every protocol run.
- Report `outcome: "failure"` when any step failed or was aborted.

**MUST NEVER**

- Respond to the user before calling `kairos_attest` when `must_obey:
  true`.
- Skip attestation on error paths — always attest, even on failure.
