Search for protocol chains matching a query. Entry point for KAIROS workflow.

**When to call:** When the user's intent maps to a protocol (coding, docs, Jira, GitLab MR, etc.). Use a search term derived from intent.

**Response:** Always `must_obey: true`. Contains `choices` array (each with `uri`, `label`, `chain_label`, `score`, `role`, `tags`), `perfect_matches` count, `message`, and `next_action` with the exact URI for the next call.

**AI decision tree:** `must_obey: true` -> follow `next_action`. Read the `choices` array if you need to pick between options.

**Choices roles:**
- `role: "match"` — search results with a `score` (0.0-1.0). Higher = better match.
- `role: "create"` — system action to create a new protocol (`score: null`). Always available as fallback.

**After search:** Call `kairos_begin` with the chosen `choice.uri` as instructed by `next_action`.
