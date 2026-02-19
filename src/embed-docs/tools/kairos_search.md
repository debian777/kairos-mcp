Search for protocol chains matching a query. Entry point for KAIROS workflow.

**When to call:** When the user's intent maps to a protocol (coding, docs, Jira, GitLab MR, etc.). Use a search term derived from intent.

**Query tip:** Prefer a concrete query (e.g. 3–8 words, nouns + verbs, domain or tool name if the user implied one). Stay faithful to the user's intent — add clarity, don't substitute your own interpretation. If the user was vague (e.g. slash-command or "do the thing"), you can expand to a likely intent; if results are weak, pick the refine choice and run that protocol for step-by-step help.

**Response:** Always `must_obey: true`. Contains `choices` array (each with `uri`, `label`, `chain_label`, `score`, `role`, `tags`, `next_action`), `message`, and a global `next_action` directive.

**AI decision tree:** `must_obey: true` -> pick one choice and follow **that choice's `next_action`**. The global `next_action` says: "Pick one choice and follow that choice's next_action." (or "Follow the choice's next_action." when there is only one choice.)

**Choices roles:**
- `role: "match"` — search results with a `score` (0.0-1.0). Higher = better match. That choice's `next_action` tells you to call `kairos_begin` with its URI.
- `role: "refine"` — get step-by-step help turning the user's request into a better query. That choice's `next_action` tells you to call `kairos_begin` with its URI (refining-help protocol).
- `role: "create"` — system action to create a new protocol (`score: null`). That choice's `next_action` tells you to call `kairos_begin` with the creation protocol URI.

**Ordering:** Match choices first (top N from search), then refine (if present), then create (if present). Refine and create are not part of the search limit.

**After search:** Pick the choice that best fits user intent (use `label`, `chain_label`, `tags`, `score`). Then follow that choice's `next_action` exactly (always `kairos_begin` with that choice's URI).
