List the agent's available spaces with human-readable names and chain
counts.

**Precondition:** None.

**Input:**

- `include_chain_titles` (optional, default `false`) — when `true`,
  each space includes a `chains` array with `chain_id`, `title`, and
  `step_count`.

**Output:** `spaces` array. Each item has:

- `name` — human-readable display name. Common values are `"Personal"`,
  `"Group: <ref>"`, and `"Kairos app"`.
- `chain_count` — number of distinct chains returned for this space in
  the current listing.
- `chains` (optional) — array of `{ chain_id, title, step_count }` when
  `include_chain_titles: true`.

The list always includes the Kairos app space. Personal and group spaces
appear only when they are present in the current allowed space context.

**MUST ALWAYS**

- Use space names (not raw IDs) in tool parameters such as `kairos_mint`.

**MUST NEVER**

- Pass raw space IDs in tool parameters; the backend resolves names to
  IDs.
