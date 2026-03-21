List **spaces** available to the caller (human-readable names) and how many adapters (chains) each contains.

**Input**

- `include_chain_titles` (optional) — when true, include per-space adapter titles and layer counts.

**Output:** `spaces` array with `name`, `chain_count`, and optionally `chains` (`chain_id`, `title`, `step_count`).

**Use:** Discover valid **`space`** names for **`activate`** and see what is deployed before running workflows.
