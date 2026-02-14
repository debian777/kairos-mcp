Attest protocol completion or failure. Finalizes the protocol and updates quality metrics.

**When to call:** When `protocol_status === 'completed'` and `attest_required: true` from `kairos_begin` or `kairos_next`.

**Input:** `uri` (final step), `outcome` (`"success"` or `"failure"`), `message` (summary), `final_solution` (matching `final_challenge` from the last response).

**After attestation:** Protocol is done. You may respond to the user.
