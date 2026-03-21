Read-only inspection of a memory or full protocol. Returns
`markdown_doc` for use with `kairos_update` or `kairos_mint`. No run
state, no nonce.

**Precondition:** You have a memory URI.

**Input:**

- `uri` — `kairos://mem/{uuid}`.
- `protocol` (optional, default `false`) — when `true`, returns the
  full chain as one markdown document; otherwise returns the single
  step's content.

**Output:**

- Default mode: `markdown_doc` (string), and optionally `uri`, `label`,
  `position`, `challenge`.
- Protocol mode: `markdown_doc` (string) begins with YAML **frontmatter**
  (`slug:` and `version:` when present), then `#` chain title and steps;
  response also includes `slug`, `uri` (chain head), `label`,
  `step_count`, and `protocol_version` when set.

**Round-trip edit flow (single step):**

1. `kairos_dump(uri)` → receive `markdown_doc`.
2. Edit `markdown_doc`.
3. `kairos_update({ uris: [uri], markdown_doc: [edited] })`.

**Round-trip edit flow (full protocol):**

1. `kairos_dump(uri, { protocol: true })` → receive full `markdown_doc`.
2. Edit.
3. `kairos_mint({ markdown_doc, llm_model_id, force_update: true })`.

**MUST NEVER**

- Use `kairos_dump` to bypass execution; use it only for inspection and
  round-trip edit flows.
