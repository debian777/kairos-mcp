Attest protocol completion or failure. **Final step** of every protocol run. Updates quality metrics for the last step.

**When to call:** When `kairos_next` (or `kairos_begin` for a single-step protocol) returns `next_action` directing you to call `kairos_attest` — i.e. when there are no more steps to solve. Call with the URI from that response, and `outcome` (success or failure) and `message` (short summary).

**Input:** `uri` (last step URI from the completion response), `outcome` (`"success"` or `"failure"`), `message` (short summary of how the protocol went).

**After attestation:** Protocol is done. You may respond to the user. Do not respond before attestation when `must_obey: true`.
