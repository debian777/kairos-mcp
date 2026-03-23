---
name: git-worktree-index-repair
description: "Fix Git commit failures in worktrees: invalid object / Error building trees. Use when commit or write-tree fails after a long hook run. Covers root-cause diagnosis via fs_usage, manual index repair, and when NOT to add hook workarounds."
---

# Git worktree index and commit repair

## When to use

- **`error: invalid object …`** for any path
- **`error: Error building trees`**
- Failure appears **after** a long **`pre-commit`** run (e.g. **`npm run lint`**)
- **`git write-tree`** fails while you believe staging is correct

## Root cause

The **index** lists a path whose **blob OID is not in this repository's object database**. In worktrees, all trees share a single `.git/objects` store, so corruption in the main repo affects every worktree.

Common sources of phantom entries:

- **Cursor/VS Code SCM integration** spawns background `git status` and `git diff` processes that refresh the index. If a stale entry exists (from a previous `git add` whose blob was later GC'd), these refreshes can carry it forward.
- **Files that were staged once, then removed.** The blob gets pruned by `git gc`, but the index entry can reappear if the IDE re-reads a cached index state.

### Diagnosis with fs_usage (macOS)

To identify which process corrupts the index:

```sh
sudo fs_usage -w -f filesys | grep 'worktrees/<name>/index'
```

Then trigger the hook (`sh .husky/pre-commit` or `git commit`) in another terminal. Look for `WrData` + `rename` pairs — those are the actual writes. In this repo, tracing confirmed only `git` subprocesses write to the index; `Cursor Helper` only reads.

### What does NOT work as a fix

- **Rebuilding the index inside the hook** (`git read-tree HEAD && git add -A` in a trap). This races with Cursor's background git processes and can make things worse by spawning additional concurrent index writers.
- **Stripping specific files** (e.g. `.claude/hooks/session-start.sh`) in the hook. Too narrow — the IDE can inject any stale entry, not just `.claude` paths.

## Manual repair (canonical)

From the repo root of the affected worktree:

```sh
git read-tree HEAD
git add -A
git write-tree >/dev/null && echo "index OK"
```

- **`read-tree HEAD`**: replaces the index with the current commit's tree.
- **`add -A`**: stages working-tree changes on top. Do **not** use **`-f`** on ignored paths.
- If **`write-tree`** fails, **do not** commit yet — there are still bad entries.

## Drop a stale path from the index (if targeted fix needed)

```sh
git rm --cached -f --ignore-unmatch <path>
git add -A
git write-tree >/dev/null && echo "index OK"
```

## Repository health (if still broken)

```sh
git fsck --no-progress 2>&1 | head -50
```

Missing blobs often need **`git fetch`** from a complete remote or repair of the **main** repo's object store (worktrees share it).

## Prevention

- **`git.autoRefresh: false`** in `.vscode/settings.json` for worktree workspaces reduces background git activity that can carry stale entries forward.
- Keep the pre-commit hook **clean** — no index-modifying workarounds. They add concurrent writers and make the race condition worse.
- Run **`git gc`** carefully in repos with many worktrees; pruned blobs can leave orphan index entries in other worktrees.

## Agent execution notes

- Prefer **`GIT_EDITOR=true`** for any Git command that might open an editor.
- Do not force-add ignored local config dirs unless the user explicitly wants them committed.
- Do not add index-modifying code to hooks. If the index is corrupt, repair it manually before committing.
