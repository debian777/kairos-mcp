List **spaces** available to the caller (human-readable names) and how many
adapters each contains.

**Input**

- `include_adapter_titles` (optional) — when true, include per-space adapter
  titles and layer counts.

**Output:** `spaces` array with `name`, `space_id`, `type` (`personal` | `group` | `app` | `other`), `adapter_count`, and optionally `adapters` (`adapter_id`, `title`, `layer_count`).

**Use:** Discover spaces and **`space`** values for **`activate`**, **`train`**, and **`tune`**. **`activate`** match rows include **`space_name`** so callers see where each protocol lives. Prefer a **personal** fork (via **`train`** + `source_adapter_uri`) when you need a variant that wins on ties against a shared group adapter.
