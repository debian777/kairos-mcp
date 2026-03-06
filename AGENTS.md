# KAIROS

KAIROS MCP is a Model Context Protocol server for persistent memory and
deterministic protocol-chain execution. It stores workflows as linked
memory chains where each step carries a proof-of-work challenge. You
execute a protocol by searching for a match, beginning the run, solving
each challenge via `kairos_next`, and attesting completion. Every hash,
nonce, and identifier is server-generated; echo them verbatim — never
compute them.

## Architecture

**Tech stack:** TypeScript (Node.js ≥ 24), Qdrant (vector DB), Redis
(state/caching), optional Keycloak (OIDC auth).

| Path | Purpose |
|------|---------|
| `src/` | TypeScript source |
| `src/embed-docs/` | MCP resources served to agents (tools, mem, prompts) |
| `dist/` | Compiled output |
| `tests/` | Integration tests |
| `tests/workflow-test/` | Agent workflow test prompt and instructions |
| `reports/` | Workflow test output (`reports/<run-id>/report.md`) |
| `docs/examples/` | Mintable protocol examples for dev workflow tests |
| `scripts/` | Build and utility scripts |

## Protocol execution model

Execute every protocol in this exact order:

1. **`kairos_search(query)`** — Returns `choices` with URIs. `must_obey:
   true`. Pick the best-matching choice; follow that choice's
   `next_action` (always `kairos_begin` with its URI).
2. **`kairos_begin(uri)`** — Loads step 1, returns its `challenge`. Step
   1 never requires a solution. Follow `next_action`.
3. **`kairos_next(uri, solution)` × N** — Advance one step at a time.
   Use the URI from the previous `next_action`. Echo `nonce` and
   `proof_hash` from the challenge (step 1) or previous response (steps
   2+). Loop until `next_action` directs you to `kairos_attest`.
4. **`kairos_attest(uri, outcome, message)`** — Final step. Call with
   the URI from the last `kairos_next` response. Respond to the user
   only after attestation completes.

### `next_action` semantics

- `must_obey: true` — Follow `next_action` exactly. Do not respond to
  the user before `kairos_attest` completes.
- `must_obey: false` — Use judgment. Choose from options in
  `next_action`. Repair with `kairos_update` when safe; otherwise ask
  the user.

## MUST ALWAYS

- Follow `next_action` when `must_obey: true`. No deviation.
- Complete `kairos_attest` before responding to the user after a
  protocol run.
- Echo `challenge.nonce` as `solution.nonce` when present.
- Echo `challenge.proof_hash` as `solution.proof_hash` for step 1.
- Echo the `proof_hash` from the previous `kairos_next` response for
  steps 2+.
- Perform the actual challenge work before submitting a solution.
- Call `kairos_search` before inventing a new workflow.
- Use Context7 when you need library/API documentation or setup steps.
- Add a `challenge` JSON block to every verifiable step when minting.
- Use space names in tool parameters; the backend resolves to IDs.
- Deploy to dev before testing: `npm run dev:deploy && npm run
  dev:test`.

## MUST NEVER

- Compute hashes, nonces, or IDs yourself. The server generates all of
  them.
- Fabricate shell output, MCP results, or user confirmations.
- Respond to the user before `kairos_attest` when `must_obey: true`.
- Re-call `kairos_begin` on error. Retry using the fresh challenge in
  the error response.
- Submit a solution whose `type` does not match `challenge.type`.
- Skip `kairos_attest` at the end of a protocol run.
- Pass raw space IDs in tool parameters; use human-readable space names.
- Promote code to live without full validation in dev.

## Challenge types

### `shell`

Run `challenge.shell.cmd`. Report actual `exit_code`, `stdout`,
`stderr`. Exit code 0 = success.

```json
{
  "type": "shell",
  "nonce": "<echo from challenge>",
  "proof_hash": "<echo from challenge or previous response>",
  "shell": { "exit_code": 0, "stdout": "...", "stderr": "" }
}
```

### `mcp`

Call `challenge.mcp.tool_name`. Report the actual result. Set
`success: true` only when the call succeeded.

```json
{
  "type": "mcp",
  "nonce": "<echo from challenge>",
  "proof_hash": "<echo from challenge or previous response>",
  "mcp": { "tool_name": "kairos_search", "result": {}, "success": true }
}
```

### `user_input`

Display `challenge.user_input.prompt` verbatim to the user. Place their
exact reply in `user_input.confirmation`. Never invent a confirmation.

```json
{
  "type": "user_input",
  "nonce": "<echo from challenge>",
  "proof_hash": "<echo from challenge or previous response>",
  "user_input": { "confirmation": "<user reply>" }
}
```

### `comment`

Write a genuine comment relevant to the step. Length must meet
`challenge.comment.min_length`.

```json
{
  "type": "comment",
  "nonce": "<echo from challenge>",
  "proof_hash": "<echo from challenge or previous response>",
  "comment": { "text": "..." }
}
```

## Error handling

Errors include `error_code`, `retry_count`, and a fresh `challenge` with
a new nonce.

- **Retries 1–3** (`must_obey: true`): Follow `next_action`. Retry
  `kairos_next` using the fresh challenge data from the error response.
- **After 3 retries** (`must_obey: false`): Choose from `next_action`
  options: fix the step via `kairos_update`, abort via `kairos_attest`
  with `outcome: "failure"`, or ask the user.

Common error codes: `NONCE_MISMATCH`, `TYPE_MISMATCH`,
`MAX_RETRIES_EXCEEDED`.

## Minting and editing protocols

When minting (`kairos_mint`) or editing (`kairos_update`) a protocol:

- Use H1 for the protocol chain title.
- Use H2 for each step label.
- End every verifiable step with a trailing ` ```json ` block containing
  `{"challenge": {...}}` (same shape as `kairos_begin`/`kairos_next`).
- Add a `## Natural Language Triggers` section as the first H2.
- Add a `## Completion Rule` section as the last H2.

## Environment context

**CRITICAL:** You are connected to **KAIROS LIVE** (production environment). Your local development environment is **dev**.

**IMPORTANT:** All code changes must follow the **full ELITE AI CODING STANDARDS protocol** to be promoted from dev to live. This means: (1) Follow the complete protocol (not just step 1 — feature branch isolation). (2) Establish baseline tests. (3) Run full test suite after changes. (4) Deploy to dev first (`npm run dev:deploy`). (5) Test against dev server. (6) Only after full validation in dev can changes be promoted to live.

| Environment | Purpose |
|-------------|---------|
| dev | Local development and integration testing |
| live | Production (KAIROS LIVE) |

Validate all code changes in dev before promoting to live. Deploy: `npm run dev:deploy && npm run dev:test`

## Context7 usage

Call Context7 MCP tools whenever you need library/API documentation.
For MCP work, search Context7 for:

1. `modelcontextprotocol`
2. `modelcontextprotocol typescript`

## MCP design principles

Apply [CONTRIBUTING.md § Agent-facing design
principles](CONTRIBUTING.md#agent-facing-design-principles) when
designing or reviewing MCP tools, agent-facing APIs, or tool schemas.
