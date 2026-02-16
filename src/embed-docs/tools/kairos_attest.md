Attest protocol completion or failure. Finalizes the protocol and updates quality metrics.

**When to call:** When `next_action` from `kairos_begin` or `kairos_next` says "call kairos_attest". This is a stamp of completion — the last step's challenge was already solved via `kairos_next`.

**Input:** `uri` (last step URI), `outcome` (`"success"` or `"failure"`), `message` (short summary of how the protocol went). No `final_solution` required.

**After attestation:** Protocol is done. You may respond to the user. Do not respond before attestation when `must_obey: true`.
