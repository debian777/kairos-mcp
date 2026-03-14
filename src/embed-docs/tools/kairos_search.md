Search for protocol chains matching a query. **For raw user messages, prefer
`kairos_run(message)`** — it runs search and begin in one step. Use
`kairos_search` when you already have a concrete query (e.g. from a
protocol-specific skill or after refine).

**Precondition:** You have a search query (user intent or derived phrase).

**Input:** `query` — 3–8 specific words (nouns + verbs). Use domain or
tool names when the user implied one. Stay faithful to the user's
intent; add specificity, do not substitute your own interpretation.
Expand slash-commands or shorthand (e.g. `/ai-docs` → `write ai
instructions zero-drift template`).

**Response:** Always `must_obey: true`. Contains `choices` array (each
with `uri`, `label`, `chain_label`, `score`, `role`, `tags`,
`next_action`, and optional `protocol_version`), `message`, and a
global `next_action`. For match choices, `protocol_version` is the
stored protocol version (e.g. semver); compare with skill-bundled
protocol to decide if re-mint is needed.

**Choice roles:**

- `role: "match"` — search result with `score` (0.0–1.0). Higher score
  = closer match. That choice's `next_action` directs you to call
  `kairos_begin` with its URI.
- `role: "refine"` — step-by-step help to build a more specific query. That
  choice's `next_action` directs you to call `kairos_begin` with the
  refine-help protocol URI.
- `role: "create"` — create a new protocol (`score: null`). That
  choice's `next_action` directs you to call `kairos_begin` with the
  creation protocol URI.

**Ordering:** Match choices first (top N), then refine (if present),
then create (if present). Refine and create are not part of the search
limit.

**AI decision tree:** `must_obey: true` — pick one choice and follow
**that choice's `next_action`**. The global `next_action` says: "Pick
one choice and follow that choice's next_action."

When results are weak (no scores above 0.5), pick the refine choice and
run that protocol for step-by-step help improving the query.

**MUST ALWAYS**

- Follow the chosen choice's `next_action`, not the global `next_action`.
- Call `kairos_begin` with the chosen URI as the next step.

**MUST NEVER**

- Reuse a vague query that already returned no strong match.
- Run `kairos_begin` with a URI not returned by this response.
