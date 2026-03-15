# KAIROS

KAIROS MCP is a Model Context Protocol server for persistent memory and
deterministic protocol-chain execution. It stores workflows as linked
memory chains where each step carries a proof-of-work challenge. You
execute a protocol by searching for a match, beginning the run, solving
each challenge via `kairos_next`, and attesting completion. Every hash,
nonce, and identifier is server-generated; echo them verbatim — never
compute them.

## Architecture

**Tech stack:** TypeScript (Node.js ≥ 25), Qdrant (vector DB), Redis
(state/caching), optional Keycloak (OIDC auth).

| Path | Purpose |
|------|---------|
| `src/` | TypeScript source |
| `src/embed-docs/` | MCP resources served to agents (tools, mem, prompts) |
| `skills/kairos-development/` | Agent instructions for kairos-dev (ai-mcp-integration, workflow-test) |
| `dist/` | Compiled output |
| `tests/` | Integration tests |
| `tests/workflow-test/` | Workflow test harness (prompt copy, how to run; canonical agent text in `skills/kairos-development/`) |
| `reports/` | Workflow test output (`reports/<run-id>/report.md`) |
| `docs/examples/` | Mintable protocol examples for dev workflow tests |
| `scripts/` | Build and utility scripts |

## Protocol execution model

Execute every protocol in this order: **`kairos_search`** → **`kairos_begin`** → **`kairos_next`** (loop until `next_action` directs to attest) → **`kairos_attest`**. Follow each tool's `next_action` and `must_obey` exactly.

**Authority:** The tool descriptions in `src/embed-docs/tools/` for `kairos_search`, `kairos_begin`, `kairos_next`, and `kairos_attest` contain all execution rules (when to call search, challenge types, nonce and proof_hash echoing, error handling). Read those tool descriptions; they are authoritative.

## MUST ALWAYS (repo context)

- Use Context7 when you need library/API documentation or setup steps.
- Add a `challenge` JSON block to every verifiable step when minting.
- Use space names in tool parameters; the backend resolves to IDs.
- Deploy to dev before testing: `npm run dev:deploy && npm run dev:test`.

## MUST NEVER (repo context)

- Pass raw space IDs in tool parameters; use human-readable space names.
- Promote code to live without full validation in dev.

## Minting and editing protocols

When minting (`kairos_mint`) or editing (`kairos_update`) a protocol:

- Use H1 for the protocol chain title.
- Use H2 for each step label.
- End every verifiable step with a trailing ` ```json ` block containing
  `{"challenge": {...}}` (same shape as `kairos_begin`/`kairos_next`).
- The opening \`\`\`json must be on its own line (line start). Blocks with
  text on the same line (e.g. `Example: \`\`\`json`) are not parsed as steps.
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
