# KAIROS

Repository-specific agent guidance for working on this codebase. This file mixes
codebase facts (paths, tool flow, tech stack) with maintainer workflow rules for
agents operating in the repository.

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
| `dist/` | Compiled output |
| `tests/` | Integration tests |
| `tests/workflow-test/` | Workflow test harness (prompt in PROMPT.md, how to run) |
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

For the maintainer workflow used with this repository, **dev** refers to the
local development environment and **live** refers to the production KAIROS
deployment.

All code changes are expected to be validated in dev before any live promotion.
In this repo that means: establish baseline expectations, run the relevant
tests, deploy to dev first (`npm run dev:deploy`), and validate against the dev
server before treating a change as production-ready.

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
