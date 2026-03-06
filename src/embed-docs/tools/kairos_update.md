Update one or more existing memories in KAIROS using markdown or
field-level updates.

**Precondition:** You have the target memory URI(s). Resolve URIs via
`kairos_search` followed by chain navigation, or use a URI already in
scope.

**Input:**

- `uris` (required) — array of `kairos://mem/{uuid}` URIs to update.
- `markdown_doc` (array of markdown strings, one per URI) — replaces
  the full content of each targeted memory.
- `updates` (field-level updates) — use when replacing specific fields
  instead of the full document.

Provide either `markdown_doc` or `updates`, not both.

**Typical round-trip edit flow:**

1. Call `kairos_dump(uri)` to retrieve the current `markdown_doc`.
2. Edit the markdown.
3. Call `kairos_update({ uris: [uri], markdown_doc: [edited_markdown] })`.

**Response:** Updated memory URI(s) and confirmation.

**MUST ALWAYS**

- Resolve the target URI before calling `kairos_update`.
- Provide one `markdown_doc` entry per URI in `uris` when using
  `markdown_doc` mode.

**MUST NEVER**

- Update a URI you have not resolved or verified.
- Mix `markdown_doc` and `updates` in the same call.
