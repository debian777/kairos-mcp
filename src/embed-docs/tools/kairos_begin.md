Start protocol execution. Loads step 1 and returns its challenge. Step 1 never requires a solution.

**When to call:** After `kairos_search` returns a URI (from `start_here` or from `choices[].uri` after you pick one). Call with that URI to begin the protocol.

**Response:** `current_step` (content + uri), `challenge` (type and description; what you must do for the next step), `protocol_status` (`continue` or `completed`), `next_step` (uri for the next call when `continue`). May include `next_action` (e.g. "call kairos_next with next step uri and solution matching challenge").

**If `protocol_status === 'continue'`:** Execute the challenge (run command, call MCP tool, get user confirmation, or write verification comment). Then call `kairos_next(next_step.uri, solution)` with a solution matching the challenge type.

**If `protocol_status === 'completed'`:** Only one step. Call `kairos_attest(uri, outcome, message, final_solution)` with `final_solution` matching `final_challenge`.
