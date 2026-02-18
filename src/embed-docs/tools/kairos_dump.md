Read-only inspection of a memory or full protocol. Returns **markdown_doc** for use with `kairos_update` or `kairos_mint`. No run state, no nonce.

**When to call:** When you have a memory URI and need to read its content before updating or re-minting. For example: after `kairos_mint` returns SIMILAR_MEMORY_FOUND (dump the existing protocol to compare), or before calling `kairos_update` to edit a step.

**Input:** `uri` (kairos://mem/{uuid}), optional `protocol` (default false). When `protocol` is true, returns the full chain as one markdown document; otherwise returns the single step’s content.

**Output:** `markdown_doc` (string). In default mode also optional `uri`, `label`, `position`, `challenge`. In protocol mode also optional `uri` (chain head), `label`, `step_count`.

**Use with update:** Get `markdown_doc` for one step → edit → `kairos_update({ uris: [uri], markdown_doc: [markdown_doc] })`.

**Use with mint:** Get `markdown_doc` with `protocol: true` → compare or edit → `kairos_mint({ markdown_doc, llm_model_id, force_update: true })`.

Do not use dump to bypass execution; use it only for inspection and round-trip edit flows.
