Search for protocol chains matching a query. Entry point for every
KAIROS workflow.

**Precondition:** You have a user intent to translate into a protocol run.

**Input:**

- `query` — 3–8 specific words (nouns + verbs). Use domain or
  tool names when the user implied one. Stay faithful to the user's
  intent; add specificity, do not substitute your own interpretation.
  Expand slash-commands or shorthand (e.g. `/ai-docs` → `write ai
  instructions zero-drift template`).
- `max_choices` (optional) — maximum number of match choices to return.
  Omit for server default. Use a higher value for broad or vague
  queries when the best match may not be in the top few.

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

**Ordering:** The server places the best action at **index 0**. You MUST
follow the top choice only; do not evaluate or pick among other choices.

**AI decision tree:** `must_obey: true` — follow **`choices[0]`**.
The global `next_action` says: "You MUST pick the top choice (index 0)
and follow its next_action."

**MUST ALWAYS**

- Follow the top choice's `next_action` (choices[0]). Call `kairos_begin`
  with that choice's URI as the next step.

**MUST NEVER**

- Reuse a vague query that already returned no strong match.
- Run `kairos_begin` with a URI not returned by this response.
