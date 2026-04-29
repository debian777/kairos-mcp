Update existing **adapter** content in place.

**Input**

- `uris` — non-empty list of `kairos://adapter/{uuid}` and/or `kairos://layer/{uuid}` targets.
- `markdown_doc` (optional) — parallel array of full markdown bodies (preferred for text changes).
- `updates` (optional) — advanced field map; prefer `markdown_doc` for ordinary edits.
- `space` (optional) — `"personal"` or a full group path such as `"{{KAIROS_GROUP_SPACE_PATH_EXAMPLE}}"`: reassign **all layers** of each targeted adapter to that space. You can use **`space` alone** (move only) or combine with `markdown_doc` / `updates` (edit then move). Adapter URI moves every layer; layer URI moves that layer only.

**Output:** `results` with per-URI `status` (`updated` | `error`) and `message`, plus totals.

**Rules:**

- Pass layer URIs when you want to edit specific layers.
- Pass adapter URIs when you want in-place edits across that adapter's stored
  layers without replacing adapter identity.
- Use **`train`** with `force_update: true` for structural replacements (for
  example, changing adapter identity/H1 mapping or layer count).
- When you pass layer URIs, the server normalizes to the underlying stored
  memories.
- Refresh execution context after large **`tune`** edits (new **`forward`**
  from the adapter URI).
