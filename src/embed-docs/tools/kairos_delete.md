Delete one or more memories from KAIROS.

**Precondition:** You have the target memory URI(s). Resolve URIs via
`kairos_search` and chain navigation before calling.

**Input:**

- `uris` (required, non-empty array) — `kairos://mem/{uuid}` URIs to
  delete.

**Response:** `results[]` with per-URI `deleted` or `error` status, plus
`total_deleted` and `total_failed`.

**MUST ALWAYS**

- Resolve and verify the target URIs before deleting.
- Confirm the user's intent to delete before calling when acting on
  user instruction.

**MUST NEVER**

- Delete a URI you have not resolved or verified.
- Call with an empty `uris` array.
