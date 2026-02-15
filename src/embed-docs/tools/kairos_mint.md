Stores markdown documents as KAIROS memories with automatic header-based organization. Each H1 defines a protocol chain; each H2 defines a step. Challenge markers (e.g. PROOF OF WORK:) in markdown become step challenges.

**When to call:** When the user wants to create, add, mint, store, or save a protocol or document. Before minting new protocols, call `kairos_search("building kairos workflows")` to get the structure guide (H1/H2, challenge syntax).

**Input:** `markdown_doc` (string), `llm_model_id` (required), `force_update` (optional, overwrite existing chain with same label).

**Response:** Chain head URI(s). You can then find the protocol via `kairos_search` with a query matching the content.
