# Architecture and protocol workflows

Use this section when implementing clients, debugging execution, or
designing new agent-facing behavior. It covers how the KAIROS protocol
works end-to-end and how each MCP tool fits into the flow.

## What you will find here

- **Infrastructure:** Container topology, port map, startup sequence,
  volume layout, and service wiring — all with Mermaid diagrams.
- **Full execution:** Walkthrough from **activate** through **reward**
  ([workflow-full-execution.md](workflow-full-execution.md)).
- **Tool workflows:** Pages named `workflow-<tool>.md` (for example
  **`workflow-activate.md`**, **`workflow-forward-first-call.md`**) are
  **companion narratives** aligned with the **current** MCP tools:
  **`activate`**, **`forward`**, **`reward`**, **`train`**, **`tune`**,
  **`export`**, **`delete`**, and **`spaces`**. Authoritative agent copy lives
  under [`src/embed-docs/tools/`](../../src/embed-docs/tools/).

Protocol order: **activate** → **forward** (loop) → **reward**.

## Infrastructure

[Infrastructure architecture](infrastructure.md) covers the Docker
Compose topology, port map, startup sequence, volume layout, Redis/Qdrant
data models, and embedding provider selection — all with Mermaid diagrams.

[Qdrant migrations at boot](qdrant-migrations-boot.md) explains how the
vector database is initialized and migrated on startup: collection
creation, dimension and BM25 migrations, and how this differs from the
separate Qdrant service initialization (payload indexes, alias).

## Search query (heart of operations)

[KAIROS search query architecture](search-query.md) describes the hybrid
search pipeline used by **`activate`**: query normalization, space scope,
Qdrant hybrid query (dense + BM25, RRF, formula), filters, attest-based
score adjustment, and cache. Read this when implementing or debugging
activation/search.

## UI frontend

[UI frontend architecture](ui-frontend-architecture.md) explains the
current React/Vite frontend, route structure under `/ui`, API boundary,
Storybook's role, and the reasons the UI stays inside the existing
Express deployment.

## Full execution walkthrough

[Full execution workflow: activate through reward](workflow-full-execution.md)
summarizes the current MCP tool chain, example calls, and links to embedded tool
docs.

## Tool reference (current MCP surface)

| Tool | Embedded description |
| ---- | -------------------- |
| [activate](../../src/embed-docs/tools/activate.md) | Semantic match; returns adapter URIs and `next_action`. |
| [forward](../../src/embed-docs/tools/forward.md) | Run adapter layers; contracts and solutions. |
| [reward](../../src/embed-docs/tools/reward.md) | Finalize a run (replaces older attest). |
| [train](../../src/embed-docs/tools/train.md) | Store adapter markdown. |
| [tune](../../src/embed-docs/tools/tune.md) | Edit stored layers / structure. |
| [export](../../src/embed-docs/tools/export.md) | Export markdown or datasets. |
| [delete](../../src/embed-docs/tools/delete.md) | Delete memories by URI. |
| [spaces](../../src/embed-docs/tools/spaces.md) | List usable space names. |

## Companion workflow pages (`workflow-*.md`)

| Page | Topic |
| ---- | ----- |
| [workflow-activate](workflow-activate.md) | **`activate`** (adapter choices, scores, next actions). See [search query architecture](search-query.md). |
| [workflow-forward-first-call](workflow-forward-first-call.md) | First **`forward`** (adapter URI, omit `solution`). |
| [workflow-forward-continue](workflow-forward-continue.md) | Later **`forward`** calls (layer URI + solution). |
| [workflow-reward](workflow-reward.md) | **`reward`** (final layer URI). |
| [workflow-train](workflow-train.md) | **`train`** (store adapter markdown). |
| [workflow-tune](workflow-tune.md) | **`tune`** (edit stored bodies / fields). |
| [workflow-delete](workflow-delete.md) | **`delete`** (adapter or layer URIs). |
| [workflow-export](workflow-export.md) | **`export`** and related inspection; see embedded docs. |
| [quality_metadata](quality-metadata.md) | How `quality_metadata` is used in Qdrant payloads; JSON examples and data flow. |

## Agent recovery UX

[Agent recovery UX](agent-recovery-ux.md) describes how to reduce
step-skipping: challenge-type-specific error messages and `next_action`
when proof is missing (for example, telling the agent to ask the user for
`user_input` instead of inferring the answer).

## Auth and URL topology

[Authentication overview](auth-overview.md) covers server auth (Bearer/session),
shared CLI and MCP config, Keycloak clients, and login flow. It also explains
which Keycloak URL each party uses and how `KEYCLOAK_URL` vs
`KEYCLOAK_INTERNAL_URL` are set in `.env` and `compose.yaml`.

## Authentication and logging

- [Authentication overview](auth-overview.md) — server auth (Bearer/session), shared CLI and MCP config, Keycloak clients, and login flow.
- [Logging](logging.md) — log levels, standard fields, logger usage in code, env vars, and error codes.

## Next steps

- For the project's mission and goals, see the [README](../../README.md).
- For setup and contribution workflow, see
  [CONTRIBUTING.md](../../CONTRIBUTING.md).
- For CLI usage, see [CLI](../CLI.md).
- For Cursor setup, see [Install KAIROS MCP in Cursor](../INSTALL-MCP.md).
- For agent-facing design doctrine, see
  [Agent-facing design principles](../../CONTRIBUTING.md#agent-facing-design-principles).
- For protocol examples and challenge types, see
  [Examples](../examples/README.md).
