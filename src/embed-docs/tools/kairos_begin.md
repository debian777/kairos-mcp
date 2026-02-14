Start protocol execution. Loads step 1 and returns its challenge.

**When to call:** After `kairos_search` returns a URI (from `start_here` or `choices[].uri`). Call with that URI to begin the protocol.

**Response:** `current_step` (content), `challenge` (what to do), `protocol_status` (`continue` or `completed`), `next_step` (uri to use for next call when `continue`).

**If `protocol_status === 'continue'`:** Execute the challenge, then call `kairos_next(next_step.uri, solution)` with proof matching the challenge type.

**If `protocol_status === 'completed'`:** Call `kairos_attest` with `final_solution`.
