List the agent's available spaces with human-readable names and chain counts. Use when the agent needs to see which spaces exist and how many chains (protocols) each contains.

**When to call:** When the user or agent asks what spaces exist, how many protocols are in each space, or for a summary of stored content per space.

**Input:** `include_chain_titles` (optional, default false). When true, each space includes a list of chains with `chain_id`, `title`, and `step_count`.

**Output:** `spaces` array. Each item has `name` (human-readable: "Personal", "Group: <ref>", "Kairos app"), `chain_count`, and optionally `chains` (array of `{ chain_id, title, step_count }`).

Spaces include the agent's personal space, any group spaces, and the Kairos app space (read-only protocols). Use space names in tool parameters (e.g. `kairos_mint` space param); do not rely on raw space ids.
