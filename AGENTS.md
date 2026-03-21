# KAIROS

Repository-specific agent guidance for working on this codebase. This file mixes
codebase facts (paths, tool flow, tech stack) with maintainer workflow rules for
agents operating in the repository.

KAIROS MCP is a Model Context Protocol server for persistent memory and
deterministic protocol-chain execution. It stores workflows as linked
memory chains where each step carries a proof-of-work challenge. You
execute a protocol by calling **`activate`** (semantic match), then
**`forward`** for each layer’s contract (loop until `next_action` directs you
to **`reward`**), then **`reward`** to finalize the run. Every hash, nonce,
and identifier is server-generated; echo them verbatim — never compute them.

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

Execute every adapter run in this order: **`activate`** → **`forward`** (loop
per layer until `next_action` directs you to **`reward`**) → **`reward`**.
Follow each tool's `next_action` and `must_obey` exactly.

**Authority:** The tool descriptions in `src/embed-docs/tools/` for
**`activate`**, **`forward`**, **`reward`**, plus **`train`**, **`tune`**,
**`export`**, **`delete`**, and **`spaces`**, contain all execution rules
(challenge types, nonce and `proof_hash` echoing, error handling). Read those
files; they are authoritative.

## MUST ALWAYS (repo context)

- Use Context7 when you need library/API documentation or setup steps.
- Add a `challenge` JSON block to every verifiable step when minting.
- Use space names in tool parameters; the backend resolves to IDs.
- Deploy to dev before testing: `npm run dev:deploy && npm run dev:test`.

## MUST NEVER (repo context)

- Pass raw space IDs in tool parameters; use human-readable space names.
- Promote code to live without full validation in dev.

## Minting and editing protocols

When minting (**`train`**) or editing (**`tune`**) adapter markdown:

- Use H1 for the protocol chain title.
- Use H2 for each step label.
- End every verifiable step with a trailing ` ```json ` block containing
  `{"challenge": {...}}` (same shape as responses from **`forward`**).
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

## ESLint: `kairos-forbidden-text` (and related hits)

When `kairos-forbidden-text/no-forbidden-kairos-text` fails in `src/`, `scripts/`, `tests/`, or `src/embed-docs/**/*.md`:

### Must always

- Remove obsolete branches, compatibility shims, and parallel implementations; keep **one** supported code path.
- **Reword** comments, strings, and identifiers with neutral terms (e.g. older format, transitional, compat, format migration).
- Preserve explanations that help the next reader; **do not** delete documentation **only** to clear the violation.
- Re-run lint on touched files before you stop.

### Must never

- Strip whole comments or docstrings **only** to silence the rule.
- Re-add identifiers enumerated in `eslint/plugins/kairos-forbidden-text.cjs` (disallowed bearer-token env vars and retired MCP tool names).
- Use other wording or phrases flagged in that plugin (see its in-source list and messages).

### Override

If the user message contains **[OVERRIDE]** anywhere, ignore this section and follow the user’s instructions exactly.
