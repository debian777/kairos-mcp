# Maintainer skills — kairos-mcp

Canonical path: **`.agents/skills/`** (not installed via `npx skills add`). Agent hosts
load repo-scoped skills from **`.agents/`** and user-scoped skills from **`~/.agents/`**.

They complement shipped agent skills in **`skills/`** (`kairos`, `kairos-bug-report`,
`kairos-install`).

## MCP environments

This repo commonly uses three MCP server instances. Each one has a different
purpose and authority boundary.

- **`KAIROS`**: Live server. Treat it as authoritative for everything and use it
  with the shipped [kairos skill](../../skills/kairos/SKILL.md). In this
  environment, you (the agent) act as a user.
- **`KAIROS-DEVELOPMENT`**: Development instance built from this worktree,
  configured at the project level in [mcp.json](../mcp.json). Use it as a
  developer/QA to validate local code changes.
- **`KAIROS-HELM-INTEGRATION`**: Kubernetes instance built from the Helm chart in
  `helm/`, configured at the project level in [mcp.json](../mcp.json). Use it as
  a developer/QA of the Helm chart to validate the deployment process and app
  availability. The app version can vary.

## Namespace: `kmcp-dev-*`

Each **`SKILL.md`** frontmatter **`name`** uses the prefix **`kmcp-dev-`**
(**k**airos **m**cp **dev**): one stable string for discovery, zero drift with
**[`AGENTS.md`](../../AGENTS.md)** (runtime vs worktree authority, MCP server
ids, npm-only tests).

| Directory (`…/SKILL.md`) | YAML `name` | When to invoke |
|----------------|-------------|----------------|
| [`kmcp-dev-build-test`](kmcp-dev-build-test/SKILL.md) | `kmcp-dev-build-test` | Build, deploy, lint, integration tests — always **`npm run`**; never default to bare Jest. |
| [`kmcp-dev-mcp-qa-e2e`](kmcp-dev-mcp-qa-e2e/SKILL.md) | `kmcp-dev-mcp-qa-e2e` | Phased E2E QA of tools against **KAIROS-DEVELOPMENT** (local dev); `.local/` trace reports. |
| [`kmcp-dev-bugfix-ship`](kmcp-dev-bugfix-ship/SKILL.md) | `kmcp-dev-bugfix-ship` | Dev reproduce → failing test → fix → PR → CI green → merge-ready. |
| [`kmcp-dev-release-semver`](kmcp-dev-release-semver/SKILL.md) | `kmcp-dev-release-semver` | Semver bump, `release/*` branch, PR, tag policy (no manual `v*` push). |
| [`kmcp-dev-ui-spec`](kmcp-dev-ui-spec/SKILL.md) | `kmcp-dev-ui-spec` | Human-facing **`src/ui/`** UX/spec, a11y, tokens; design-lint. |
| [`kmcp-dev-git-editor-safe`](kmcp-dev-git-editor-safe/SKILL.md) | `kmcp-dev-git-editor-safe` | Agent shell Git without opening `code --wait` editor. |
| [`kmcp-dev-git-index-repair`](kmcp-dev-git-index-repair/SKILL.md) | `kmcp-dev-git-index-repair` | Invalid object / tree build failures; Husky bisect; index repair. |
| [`kmcp-dev-worktree-env`](kmcp-dev-worktree-env/SKILL.md) | `kmcp-dev-worktree-env` | Worktree **`.env*`** not shared with main; unique **`PORT`** / **`METRICS_PORT`** per checkout on one host; **`deploy-copy-env-from-main.sh`**; Run Task **Copy .env from main**. |
| [`kmcp-dev-repowiki-sync`](kmcp-dev-repowiki-sync/SKILL.md) | `kmcp-dev-repowiki-sync` | Qoder Repo Wiki → GitHub Wiki one-way sync via **`repowiki/sync`** forever branch; rebase from main, update wiki, MR without deleting source branch; content in `.qoder/repowiki/en/content/`; plain `rsync` + Git; setup perms with `gh` CLI. |
| [`kmcp-dev-doc-governance`](kmcp-dev-doc-governance/SKILL.md) | `kmcp-dev-doc-governance` | Audit/auto-repair doc drift against the `documentation-authority` rule; `npm run lint:docs`; keep curated `docs/` DRY vs RepoWiki; colocated-README contract; run after significant merges and before releases. |
| [`kmcp-dev-mcp-host-bridge-pointer`](kmcp-dev-mcp-host-bridge-pointer/SKILL.md) | `kmcp-dev-mcp-host-bridge-pointer` | Router only → **`.agents/skills/mcp-host-bridge`**. |

## Shared skills

These skills live in `.agents/skills/` but do not follow the `kmcp-dev-*`
namespace.

- [mcp-host-bridge](mcp-host-bridge/SKILL.md): MCP environment purpose and host
  troubleshooting (server id resolution, auth errors).

## Default flow (muscle memory)

1. **Change code** → obey **`AGENTS.md`** and **`skills/kairos/SKILL.md`** for any adapter/tool execution story.
2. **Verify** → **`kmcp-dev-build-test`** (`dev:deploy` → `dev:test`).
3. **MCP regression** → **`kmcp-dev-mcp-qa-e2e`** (optional strict phase-1 MCP-only).
4. **Production bug** → **`kmcp-dev-bugfix-ship`** (+ `reports/` via **`skills/.system/kairos-bug-report`**).
5. **Release** → **`kmcp-dev-release-semver`** (see also `.github/workflows/README.md`).
6. **UI work** → **`kmcp-dev-ui-spec`**.
7. **Git pain** → **`kmcp-dev-git-editor-safe`** + **`kmcp-dev-git-index-repair`**.
8. **New worktree / missing `.env`** → **`kmcp-dev-worktree-env`** (sync from main before dev commands if needed).
9. **Wiki sync** → **`kmcp-dev-repowiki-sync`** (forever branch `repowiki/sync`; rebase from main → update → MR → merge with branch preserved).
10. **Doc drift / DRY audit** → **`kmcp-dev-doc-governance`** (`npm run lint:docs`; run after significant merges and before releases).
11. **MCP server id / auth errors** → [mcp-host-bridge](mcp-host-bridge/SKILL.md).

## Authoring rules

- One primary concern per skill; link to **`CONTRIBUTING.md`** / **`AGENTS.md`** instead of forking command lists.
- Keep bodies maintainable (~500 lines); spill long checklists to `references/` if needed.
- `npm run lint:skills` validates only **`skills/`**; these files still use valid Agent Skills-style frontmatter.
