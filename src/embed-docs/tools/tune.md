Update existing **adapter** content in place.

**Input**

- `uris` — non-empty list of `kairos://adapter/{uuid}` and/or `kairos://layer/{uuid}` targets.
- `content` (optional) — parallel array of full markdown bodies (preferred for text changes).
- `updates` (optional) — advanced field map; prefer `content` for ordinary edits.
- `space` (optional) — `"personal"` or a full group path such as `"{{KAIROS_GROUP_SPACE_PATH_EXAMPLE}}"`: reassign **all layers** of each targeted adapter to that space. You can use **`space` alone** (move only) or combine with `content` / `updates` (edit then move). Adapter URI moves every layer; layer URI moves that layer only.

**Output:** `results` with per-URI `status` (`updated` | `error`) and `message`, plus totals.

**Rules:** When you pass layer URIs, the server normalizes to the underlying stored memories. Refresh execution context after large structural **`tune`** changes (new **`forward`** from the adapter URI).
