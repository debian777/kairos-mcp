Run an **adapter** layer-by-layer. Each layer exposes a **contract** (what to satisfy) and accepts a **solution**.

**URI**

- `kairos://adapter/{uuid}` or `kairos://adapter/{slug}` — start a **new**
  execution (server assigns `execution_id`). Slug adapter URIs resolve to the
  adapter entry layer before execution starts. If several adapters share the same slug,
  the server picks one deterministically (default write space preferred) and may set
  **`slug_disambiguation_note`** on the response — prefer an explicit `kairos://adapter/{uuid}` when you see it.
- `kairos://layer/{uuid}` or `kairos://layer/{uuid}?execution_id={uuid}` — continue the same run; reuse `execution_id` from the last response when the layer URI includes it.

**Input**

- `uri` — adapter or layer URI as above.
- `solution` — omit on the **first** call for a run to load the current layer and contract only. For later calls, supply a solution whose `type` matches `contract.type`.

**Output:** `must_obey`, `current_layer` (markdown body), `contract` (includes `type`: `tensor` | `shell` | `mcp` | `user_input` | `comment`; for proof layers, echo server `nonce` / `proof_hash` in the solution when present), optional `tensor_in`, `next_action`, optional `execution_id`, `proof_hash`, optional `slug_disambiguation_note` when a slug URI matched multiple adapters, optional `activation_space_name`, `context_adapter_name`, `current_layer_label`, `adapter_layer_index`, `adapter_layer_count` (widget progress), error fields on retry paths.

**Flow**

1. **`activate`** → pick adapter URI → **`forward`** with adapter URI and **no** `solution`.
2. Read `contract` and `next_action`. Complete the work the contract describes.
3. **`forward`** again with the **layer** URI from the response and a matching `solution`.
4. Repeat until `next_action` directs you to **`reward`** on the final layer URI.

**Tensor contracts:** supply `solution.tensor` matching `contract.tensor.output.name` and type constraints; prior tensor outputs may be merged per `tensor_in`.

**MUST ALWAYS:** Echo server-issued `nonce`, `proof_hash`, and URIs exactly. Follow `next_action` verbatim.

**MUST NEVER:** Invent URIs; skip layers; submit a solution type that does not match `contract.type`.
