# Maintainer skills — kairos-mcp

Canonical path: **`.agents/skills/`** (not installed via `npx skills add`). The same
tree is linked for hosts as **`.cursor/skills`** and **`.claude/skills`** (repo-root
symlinks → **`.agents/skills`**).

They complement shipped agent skills in **`skills/`** (`kairos`, `kairos-bug-report`,
`kairos-install`).

## Namespace: `kmcp-dev-*`

Each **`SKILL.md`** frontmatter **`name`** uses the prefix **`kmcp-dev-`**
(**k**airos **m**cp **dev**): one stable string for discovery, zero drift with
**[`AGENTS.md`](../../AGENTS.md)** (runtime vs worktree authority, MCP server
ids, npm-only tests).

| Directory (`…/SKILL.md`) | YAML `name` | When to invoke |
|----------------|-------------|----------------|
| [`kmcp-dev-build-test`](kmcp-dev-build-test/SKILL.md) | `kmcp-dev-build-test` | Build, deploy, lint, integration tests — always **`npm run`**; never default to bare Jest. |
| [`kmcp-dev-mcp-qa-e2e`](kmcp-dev-mcp-qa-e2e/SKILL.md) | `kmcp-dev-mcp-qa-e2e` | Phased E2E QA of tools against **KAIROS-DEVELOPMENT**; `.local/` trace reports. |
| [`kmcp-dev-bugfix-ship`](kmcp-dev-bugfix-ship/SKILL.md) | `kmcp-dev-bugfix-ship` | Live reproduce → failing test → fix → PR → CI green → merge-ready. |
| [`kmcp-dev-release-semver`](kmcp-dev-release-semver/SKILL.md) | `kmcp-dev-release-semver` | Semver bump, `release/*` branch, PR, tag policy (no manual `v*` push). |
| [`kmcp-dev-ui-spec`](kmcp-dev-ui-spec/SKILL.md) | `kmcp-dev-ui-spec` | Human-facing **`src/ui/`** UX/spec, a11y, tokens; design-lint. |
| [`kmcp-dev-git-editor-safe`](kmcp-dev-git-editor-safe/SKILL.md) | `kmcp-dev-git-editor-safe` | Agent shell Git without opening `code --wait` editor. |
| [`kmcp-dev-git-index-repair`](kmcp-dev-git-index-repair/SKILL.md) | `kmcp-dev-git-index-repair` | Invalid object / tree build failures; Husky bisect; index repair. |
| [`kmcp-dev-worktree-env`](kmcp-dev-worktree-env/SKILL.md) | `kmcp-dev-worktree-env` | Worktree **`.env*`** not shared with main; unique **`PORT`** / **`METRICS_PORT`** per checkout on one host; **`deploy-copy-env-from-main.sh`**; Run Task **Copy .env from main**. |
| [`kmcp-dev-mcp-host-bridge-pointer`](kmcp-dev-mcp-host-bridge-pointer/SKILL.md) | `kmcp-dev-mcp-host-bridge-pointer` | Router only → **`.agents/skills/mcp-host-bridge`**. |

## Default flow (muscle memory)

1. **Change code** → obey **`AGENTS.md`** and **`skills/kairos/SKILL.md`** for any adapter/tool execution story.
2. **Verify** → **`kmcp-dev-build-test`** (`dev:deploy` → `dev:test`).
3. **MCP regression** → **`kmcp-dev-mcp-qa-e2e`** (optional strict phase-1 MCP-only).
4. **Production bug** → **`kmcp-dev-bugfix-ship`** (+ `reports/` via **`skills/.system/kairos-bug-report`**).
5. **Release** → **`kmcp-dev-release-semver`** (see also `.github/workflows/README.md`).
6. **UI work** → **`kmcp-dev-ui-spec`**.
7. **Git pain** → **`kmcp-dev-git-editor-safe`** + **`kmcp-dev-git-index-repair`**.
8. **New worktree / missing `.env`** → **`kmcp-dev-worktree-env`** (sync from main before dev commands if needed).
9. **MCP server id / auth errors** → **`kmcp-dev-mcp-host-bridge-pointer`** (canonical bridge skill).

## Authoring rules

- One primary concern per skill; link to **`CONTRIBUTING.md`** / **`AGENTS.md`** instead of forking command lists.
- Keep bodies maintainable (~500 lines); spill long checklists to `references/` if needed.
- `npm run lint:skills` validates only **`skills/`**; these files still use valid Agent Skills-style frontmatter.
