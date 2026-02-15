Attest protocol completion or failure. Finalizes the protocol and updates quality metrics.

**When to call:** When `protocol_status === 'completed'` and `attest_required: true` from `kairos_begin` or `kairos_next`.

**Input:** `uri` (final step URI), `outcome` (`"success"` or `"failure"`), `message` (short summary), `final_solution` (same shape as solution; must match `final_challenge` from the last response).

**After attestation:** Protocol is done. You may respond to the user. Do not respond before attestation when `must_obey: true`.
