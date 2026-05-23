---
name: kmcp-dev-repowiki-sync
description: >-
  kairos-mcp: Qoder Repo Wiki to GitHub Wiki one-way sync workflow.
  Source of truth is .qoder/repowiki/en/content/. GitHub Wiki is a
  generated publication target only. Covers setup, content editing,
  CI workflow, manual sync, and troubleshooting.
---

# Repo Wiki → GitHub Wiki sync (kairos-mcp)

**Repository:** `kairos-mcp`
**Agent contract:** [`AGENTS.md`](../../../AGENTS.md)
**Skill index:** [`.agents/skills/README.md`](../README.md) (`kmcp-dev-*`)

## Architecture

```text
.qoder/repowiki/en/content/**  →  GitHub Action (rsync)  →  {repo}.wiki.git
```

- **Source of truth:** `.qoder/repowiki/en/content/` in the main repository.
- **Publication target:** `debian777/kairos-mcp.wiki.git` (GitHub Wiki).
- **Direction:** One-way only. Never edit the GitHub Wiki directly.
- **Trigger:** Push to `main` that changes content or the workflow file.
- **Manual trigger:** `workflow_dispatch` via GitHub UI or `gh workflow run`.

## Key files

| Path | Purpose |
|------|---------|
| `.qoder/repowiki/en/content/` | Wiki source markdown (committed, PR-reviewed) |
| `.qoder/repowiki/en/content/Home.md` | GitHub Wiki landing page |
| `.qoder/repowiki/en/content/_Sidebar.md` | GitHub Wiki navigation sidebar |
| `.qoder/repowiki/en/meta/` | Qoder-managed metadata (**do not edit**) |
| `.github/workflows/sync-qoder-repowiki-to-github-wiki.yml` | CI workflow |
| `scripts/sync-wiki.sh` | Local manual sync (mirrors CI logic) |
| `scripts/setup-github-wiki-permissions.sh` | One-time `gh` CLI permission setup |

## Must always

- Edit wiki content only under `.qoder/repowiki/en/content/`.
- Use `Home.md` as the wiki landing page (not `README.md`).
- Update `_Sidebar.md` when pages are added, renamed, or removed.
- Use stable page names. GitHub Wiki links use `[[Page Name]]` syntax.
- Let the CI workflow publish after merge to `main`.
- Run `./scripts/setup-github-wiki-permissions.sh` before first use (enables wiki + Actions write perms).

## Must never

- Edit the GitHub Wiki UI directly (it is overwritten on each sync).
- Edit `.qoder/repowiki/en/meta/` (Qoder-managed, required for IDE wiki loading).
- Implement bidirectional sync.
- Use a complex third-party action (plain `rsync` + Git is sufficient).
- Create empty commits when no changes exist.

## GitHub Wiki markdown formatting

GitHub Wiki renders markdown with specific behavior that differs from standard
GitHub Flavored Markdown in `.md` files:

### Headers

- Headers use `#`, `##`, `###` syntax in source, but GitHub Wiki renders them
  as `<h1>`, `<h2>`, `<h3>` HTML elements — **not** as markdown-style headers
  with anchor links in the same way as repo `.md` files.
- The text inside header elements is **plain text**, not formatted markdown.
  You cannot nest inline formatting (bold, code spans) reliably inside a header
  link target.
- Header anchor slugs are auto-generated from the header text
  (`## Getting Started` → `#getting-started`). Use these for internal
  cross-page section links: `[text](Page-Name#section-slug)`.

### Internal page links

- GitHub Wiki supports two link syntaxes for internal pages:
  - **Markdown:** `[[Page Name]]` (preferred for wiki navigation)
  - **Markdown with label:** `[[Page Name|Custom Link Text]]`
  - **Full URL:** `[Link Text](https://github.com/owner/repo/wiki/Page-Name)`
- The `[[Page Name]]` syntax resolves to `Page Name.md` in the wiki repo.
  Spaces in the filename become spaces in the link; special characters are
  URL-encoded.

### Images

- Images embedded in the wiki repo use **relative paths**: `![alt](image.png)`
- The image file must exist in the same wiki repo (not in the main repo).
- SVG, PNG, and GIF are supported. SVG renders at native size unless constrained
  with HTML: `<img src="image.svg" width="120">`.

### Sidebar (`_Sidebar.md`)

- `_Sidebar.md` is a special file that GitHub Wiki renders as the left
  navigation panel.
- Use `[[Page Name]]` links for internal pages.
- Use `---` for horizontal rules (section dividers).
- The sidebar is plain markdown — no complex HTML or custom CSS is supported.

## Adding a new wiki page

1. Create `NewPage.md` in `.qoder/repowiki/en/content/`.
2. Add `- [[NewPage]]` to `_Sidebar.md`.
3. Commit, push, PR, merge to `main`.
4. CI publishes automatically.

## Qoder Repo Wiki integration

Qoder IDE generates and updates content in `.qoder/repowiki/en/content/`:

- **Generation:** Triggered on project open or Git HEAD changes (~120 min for large repos).
- **Update:** Qoder detects code changes and offers "Update" for affected sections.
- **Synchronize:** If you edit markdown in the Git directory, click "Synchronize" in Qoder to push changes back to the IDE wiki view.
- **Team sharing:** The directory is committed (not gitignored), so teammates get it via `git pull`.

Keep code changes under 10,000 lines per update to avoid generation errors.

## Manual sync (local)

```bash
./scripts/sync-wiki.sh
```

Uses `rsync -a --delete` to mirror content, then pushes to `master` on the wiki repo.

## First-time setup

```bash
# 1. Set GitHub repo permissions (wiki enabled + Actions read-write)
./scripts/setup-github-wiki-permissions.sh

# 2. If wiki was never initialized, create first page in GitHub UI:
#    https://github.com/debian777/kairos-mcp/wiki → Create "Home" page

# 3. Push content to main → workflow runs automatically
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow fails: "repository not found" | Wiki never initialized | Create first page via GitHub UI |
| Workflow fails: "permission denied" | Actions lacks write permission | Run `setup-github-wiki-permissions.sh` |
| Content not appearing on wiki | Merge not to `main`, or path filter didn't match | Check branch and changed paths |
| Sidebar missing | `_Sidebar.md` not in content dir | Create it |
| Stale wiki content | Someone edited wiki directly | Rerun workflow; direct edits are overwritten |

## Related skills

- [`kmcp-dev-build-test`](../kmcp-dev-build-test/SKILL.md) — build/test after changes.
- [`kmcp-dev-worktree-env`](../kmcp-dev-worktree-env/SKILL.md) — worktree `.env` handling.
