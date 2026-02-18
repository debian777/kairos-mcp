Attest protocol completion or failure. Updates quality metrics for the last step.

**Deprecated:** No longer part of the default protocol. Quality is updated in `kairos_next`; the run is complete when `next_action` says "Run complete." You do not need to call `kairos_attest`. This tool remains available for optional override (e.g. to set outcome or message after the fact) or backward compatibility.

**Input:** `uri` (last step URI), `outcome` (`"success"` or `"failure"`), `message` (short summary of how the protocol went). No `final_solution` required.

**After attestation:** Protocol is done. You may respond to the user. Do not respond before attestation when `must_obey: true`.
