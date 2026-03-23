Update one or more existing memories in KAIROS using markdown or
field-level updates.

**Precondition:** You have the target memory URI(s). Resolve URIs via
`kairos_search` followed by chain navigation, or use a URI already in
scope.

**Input:**

- `uris` (required) — array of `kairos://mem/{uuid}` URIs to update.
- `markdown_doc` (array of markdown strings, one per URI) — Markdown
  BODY or full KAIROS render. If BODY markers are present, only the BODY
  is stored.
- `updates` (field-level updates) — use when replacing specific fields
  instead of the full document.

If both are provided, a non-empty `markdown_doc[i]` takes precedence for
that URI. Otherwise `updates` is applied.

**Typical round-trip edit flow:**

1. Call `kairos_dump(uri)` to retrieve the current `markdown_doc`.
2. Edit the markdown.
3. Call `kairos_update({ uris: [uri], markdown_doc: [edited_markdown] })`.

**Response:** `results[]` with per-URI `updated` or `error` status, plus
`total_updated` and `total_failed`.

**MUST ALWAYS**

- Resolve the target URI before calling `kairos_update`.
- Provide one `markdown_doc` entry per URI in `uris` when using
  `markdown_doc` mode.

**MUST NEVER**

- Update a URI you have not resolved or verified.
