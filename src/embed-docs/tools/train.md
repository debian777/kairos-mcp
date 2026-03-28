Register a new **adapter** from markdown (one H1 = one adapter; each verifiable segment ends with a fenced `json` block containing a top-level **`contract`** object).

**Input**

- `markdown_doc` — full document string (optional if `source_adapter_uri` supplies content).
- `llm_model_id` — required model identifier string.
- `force_update` (optional) — replace an existing adapter with the same label.
- `protocol_version` (optional) — version string (e.g. semver) stored on the adapter.
- `space` (optional) — `"personal"` or a full group path such as `"/kairos-shares/kairos-operator"` (target space for the new adapter).
- `source_adapter_uri` (optional) — `kairos://adapter/{uuid}` to **fork**: export that adapter’s markdown and mint a **new** adapter (new ids). If you also pass `markdown_doc`, that text is used instead of the export (customize before mint).

**Required structure (validated before store)**

- H1 title for the adapter.
- First H2: **Activation Patterns**.
- Last H2: **Reward Signal**.
- At least one fenced **` ```json `** block whose JSON has a top-level
  **`contract`** object.
- Contract fences must use the `json` language tag only (no plain ``` blocks holding contract JSON).

**Output:** `status: stored` and `items` with `layer_uuid`, `adapter_uri`, `layer` URIs, labels, tags.

**After train:** Use **`activate`** / **`forward`** to execute; use **`tune`** to edit stored layers; **`export`** to dump markdown or datasets.

See MCP resource `kairos://doc/building-kairos-workflows` for contract shapes and examples.
