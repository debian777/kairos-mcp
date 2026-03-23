---
name: git-worktree-index-repair
description: "Fix Git commit failures in worktrees: invalid object / Error building trees. Use when commit or write-tree fails after a long hook run. Covers fs_usage diagnosis, Husky pre-commit bisection (skip lint first), manual read-tree repair, and this repo’s post-lint index cleanup in .husky/pre-commit."
---

# Git worktree index and commit repair

## When to use

- **`error: invalid object …`** for any path
- **`error: Error building trees`**
- Failure appears **after** a long **`pre-commit`** run (for example **`npm run lint`**)
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

## Pinpoint which pre-commit step correlates with the break

When the failure happens **during or right after** Husky, **bisect the hook** instead of guessing. Treat “index broke” as: either a **missing object** in the shared ODB, or a **phantom staged path** whose blob is gone.

**Procedure (recommended order):**

1. **Rebuild a known-good index**, then stage only what you intend to commit (see [Manual repair](#manual-repair-canonical)). Avoid `git add -A` while debugging if it keeps re-staging bad paths.
2. **Temporarily disable one hook step at a time**, re-run `git commit` after each change:
   - **Start with `npm run lint`.** Comment it out or wrap it in a guard (for example skip when `KAIROS_SKIP_PRECOMMIT_LINT=1` is set). It is the longest step and the most common window for IDE or tooling to race the index.
   - If the commit **succeeds with lint skipped**, re-enable lint and skip the **next** heavy or git-touching step (for example `npm run lint:skills` when `skills/` is staged, or `npm run version:check-skills` when version files are staged).
   - If the commit **still fails with only lint skipped**, the problem may be **before** lint (early hook logic) or **object DB corruption** unrelated to ESLint — run `git fsck` and `git fetch` from the **main** repo (not only the worktree path).
3. **Trace hook order** when unclear:

   ```sh
   sh -x .husky/pre-commit 2>&1 | tee /tmp/precommit.trace
   ```

4. **Emergency commit:** `HUSKY=0 git commit` is allowed only after you note which steps were skipped; run the same checks in CI or `npm run lint` locally afterward.

**Interpretation:**

- **Fails only when lint runs:** suspect concurrent index writers during the long ESLint pass, or phantom paths that appear mid-hook. The repo’s `.husky/pre-commit` includes a **post-lint** pass that drops staged paths whose blob OID is missing from the ODB — see the file for the current implementation.
- **Fails even with the whole hook disabled:** suspect **missing git objects** (`git fsck`), not Husky.

### What does NOT work as a fix

- **Rebuilding the index inside the hook** (`git read-tree HEAD && git add -A` in a trap). This races with Cursor's background git processes and can make things worse by spawning additional concurrent index writers.

### Repo-specific note (this repository)

**Authority:** `.husky/pre-commit` in the repo. It currently includes (among other checks) **`npm run lint`**, optional **`lint:skills`**, version checks, and a **post-lint** loop that runs **`git rm --cached`** on staged paths whose blob is absent from the object database. Do not duplicate stale snippets from this skill — read the hook file when automating fixes.

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

When you need a **minimal** stage (for example only version-bump files), prefer explicit `git add <paths>` after `read-tree HEAD` instead of `add -A`.

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
- Run **`git gc`** carefully in repos with many worktrees; pruned blobs can leave orphan index entries in other worktrees.

## Agent execution notes

- Prefer **`GIT_EDITOR=true`** for any Git command that might open an editor.
- Do not force-add ignored local config dirs unless the user explicitly wants them committed.
- If the index is corrupt for paths other than known offenders, repair manually (**read-tree** + targeted **`git add`** + **`write-tree`**) before committing.
