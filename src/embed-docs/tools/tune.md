Update existing **adapter** content in place.

**Input**

- `uris` — non-empty list of `kairos://adapter/{uuid}` and/or `kairos://layer/{uuid}` targets.
- `markdown_doc` (optional) — parallel array of full markdown bodies (preferred for text changes).
- `updates` (optional) — advanced field map; prefer `markdown_doc` for ordinary edits.

**Output:** `results` with per-URI `status` (`updated` | `error`) and `message`, plus totals.

**Rules:** When you pass layer URIs, the server normalizes to the underlying stored memories. Refresh execution context after large structural **`tune`** changes (new **`forward`** from the adapter URI).
