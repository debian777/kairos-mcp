Search for protocol chains matching a query. Entry point for KAIROS workflow.

**When to call:** When the user's intent maps to a protocol (coding, docs, Jira, GitLab MR, etc.). Use a search term derived from intent.

**Response branches:**
- `must_obey: true` + `start_here: uri` — Single match: call `kairos_begin(uri)` immediately
- `must_obey: false` + `choices: [{uri, label}...]` — Multiple matches: choose one, call `kairos_begin(choice.uri)` to commit
- `protocol_status: 'no_protocol'` — No results: suggest minting or rephrasing

**must_obey semantics:** When multiple or partial matches, `must_obey: false` lets you choose. Once you call `kairos_begin` with a choice, execution becomes mandatory (`must_obey: true`).
