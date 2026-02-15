Update one or more memories in the KAIROS using markdown_doc or updates.

**When to call:** When the user wants to replace, modify, update, edit, or change existing KAIROS content. Resolve the target memory first (e.g. via `kairos_search` and then navigating to the step, or by URI).

**Input:** `uris` (array of kairos://mem/{uuid} URIs), and either `markdown_doc` (array of markdown strings, one per URI) or `updates` (field-level updates).
