List **spaces** available to the caller (human-readable names) and how many
adapters each contains.

**Input**

- `include_adapter_titles` (optional) — when true, include per-space adapter
  titles and layer counts.

**Output:** `spaces` array with `name`, `adapter_count`, and optionally
`adapters` (`adapter_id`, `title`, `layer_count`).

**Use:** Discover valid **`space`** names for **`activate`** and see what is deployed before running workflows.
