Find and start executable workflows matching the user's intent.

**PROACTIVE USE:** Call this tool whenever the user's message describes
an action, task, workflow, or procedure — even if they do not mention
KAIROS, protocols, or tools. The user's natural language IS the query.

**Input:**

- `query` — the user's message or a concise intent phrase (3–8 words
  preferred, but natural language accepted). Stay faithful to the
  user's intent; add specificity, do not substitute your own
  interpretation. Expand slash-commands or shorthand (e.g. `/ai-docs` →
  `write ai instructions zero-drift template`).
- `space` (optional) — scope results to a specific allowed space by
  name.
- `space_id` (optional) — alias for `space`.
- `max_choices` (optional) — maximum number of match choices to return.
  Omit for server default. Use a higher value for broad or vague
  queries when the best match may not be in the top few.

**Response:** Always `must_obey: true`. Contains `choices` array (each
with `uri`, `label`, `chain_label`, `score`, `role`, `tags`,
`next_action`, and optional `protocol_version`), `message`, and a
global `next_action`. For match choices, `protocol_version` is the
stored protocol version (for example, semver). Match choices are
already filtered by the server's configured minimum score threshold
before they are returned.

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
limit. If there is exactly one match with score `>= 0.5`, the server
omits the refine and create choices.

**AI decision tree:** `must_obey: true` — pick one choice and follow
**that choice's `next_action`**. The global `next_action` says: "Pick
one choice and follow that choice's next_action."

When results are weak (for example, no scores above 0.5) and a refine
choice is present, pick it and run that protocol for step-by-step help
improving the query.

**MUST ALWAYS**

- Follow the chosen choice's `next_action`, not the global `next_action`.
- Call `kairos_begin` with the chosen URI as the next step.

**MUST NEVER**

- Reuse a vague query that already returned no strong match.
- Run `kairos_begin` with a URI not returned by this response.
