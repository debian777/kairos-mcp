List the agent's available spaces with human-readable names and chain
counts.

**Precondition:** None.

**Input:**

- `include_chain_titles` (optional, default `false`) — when `true`,
  each space includes a `chains` array with `chain_id`, `title`, and
  `step_count`.

**Output:** `spaces` array. Each item has:

- `name` — human-readable: `"Personal"`, `"Group: <ref>"`, or
  `"Kairos app"`.
- `chain_count` — number of protocol chains in this space.
- `chains` (optional) — array of `{ chain_id, title, step_count }` when
  `include_chain_titles: true`.

Spaces include the agent's personal space, any group spaces, and the
Kairos app space (read-only protocols).

**MUST ALWAYS**

- Use space names (not raw IDs) in tool parameters such as `kairos_mint`.

**MUST NEVER**

- Pass raw space IDs in tool parameters; the backend resolves names to
  IDs.
