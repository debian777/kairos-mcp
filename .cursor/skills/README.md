# Cursor skills index (repo-local)

This directory contains repo-scoped Cursor skills. Keep skills DRY:

- Put one concern in one skill.
- Link to canonical docs (`CONTRIBUTING.md`, `AGENTS.md`) instead of duplicating.
- Cross-reference sibling skills when behavior overlaps.
- Prefer concise router skills that point to a single source of truth.

Current skills:

- `repo-build-test` — build/deploy/test policy for this repo.
- `git-terminal-no-gui` — prevent Git from opening GUI editors in agent shells.
- `git-worktree-index-repair` — recover from worktree index corruption.
- `kairos-bug-fix` — end-to-end bug fix flow from report to green PR.
- `version-bump-release` — deterministic version bump and release PR workflow.
- `kairos-ui-designer` — UI/UX design guidance for KAIROS UI work.
- `cursor-mcp-server-ids` — deprecated pointer to `.agents/skills/mcp-host-bridge`.
