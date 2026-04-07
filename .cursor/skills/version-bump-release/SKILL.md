---
name: version-bump-release
description: "Deterministic version bump and release workflow. Use when the user says: bump version, cut a release, create a release, version-bump PR, or similar release-related requests."
---

# Version bump and release

Releases work **with or without this skill**.

- **Without skill:** Run `npm version <type> --no-git-tag-version` (or use the
  repo `npm run release:<type>` targets), then `npm run version:sync-skills`
  when you did not use a `release:*` script, then branch, commit, push, and
  open the PR yourself.
- **With skill:** The skill helps (1) choose the next version type, (2) get your
  confirmation, and (3) automate the rest.

---

## 1. Choose next version type

Inspect commits since the latest tag (or all commits when no tag exists yet):

```bash
TAG=$(git describe --tags --abbrev=0 2>/dev/null); [ -n "$TAG" ] && git log "${TAG}..HEAD" --oneline || git log --oneline
```

Recommend a type from conventional commits:

| Signal | Type | npm target |
|--------|------|------------|
| `BREAKING CHANGE` / `feat!:` / `fix!:` | **major** | `release:major` |
| `feat:` (backward-compatible) | **minor** | `release:minor` |
| `fix:` / `docs:` / `chore:` / `refactor:` / `ci:` / `test:` | **patch** | `release:patch` / `release:bug` |
| User wants prerelease | **rc** / **beta** / **pre** | `release:rc` / `release:beta` / `release:pre` |

If confidence is below 95%, ask the user.

---

## 2. User confirmation

**Before any version change, ask the user to confirm the version type (and value
if helpful).** After confirmation, run the full automation below without further
questions.

---

## 3. Automated steps (after confirmation)

Run from **repo root**, in order.

### 3.1 Ensure latest main

```bash
git fetch origin main
git checkout main
git pull origin main
```

### 3.2 Create release branch and run release target

Create a temporary branch, run the chosen npm target (it runs
`npm version ... --no-git-tag-version` and `npm run version:sync-skills`), then
rename the branch to `release/<version>`:

```bash
git checkout -b release/next
npm run release:<type>
```

Replace `<type>` with one of: `major`, `minor`, `patch`, `bug`, `rc`, `pre`,
`beta`.

Then rename the branch to the actual version:

```bash
VERSION=$(node -p "require('./package.json').version")
git branch -m release/next "release/$VERSION"
```

### 3.3 Commit, push, open PR

Stage everything the sync step can change (see **What `version:sync-skills`
does** below). Prefer a quick `git status` if anything looks unexpected.

```bash
git add package.json package-lock.json src/embed-docs/mem/ skills/
git commit -m "release: $VERSION"
git push -u origin "release/$VERSION"
gh pr create --base main --head "release/$VERSION" \
  --title "release: $VERSION" \
  --body "Version bump to $VERSION."
```

### 3.4 Show clickable PR URL

After `gh pr create`, the CLI prints the PR URL. Present that URL clearly to the
user (for example as a clickable link in your response). If you need it
explicitly:

```bash
gh pr view --json url -q .url
```

**Do not create a git tag.** Tags are created after the version-bump PR merges
to `main` when Integration succeeds (see
`.github/workflows/release-tag-on-version-bump.yml`). Do not push `refs/tags/v*`
manually; **pre-push** blocks it.

---

## 4. What `version:sync-skills` does

Implementation: `scripts/build-sync-skill-versions.mjs` (also run during
`prebuild`).

1. **`src/embed-docs/mem/*.md`**  
   Frontmatter `version` is set to **`package.json` `version`** (including
   prerelease).

2. **Top-level skill trees under `skills/`**  
   For each **immediate** subdirectory of `skills/` (for example `skills/kairos/`),
   if `SKILL.md` contains a metadata `version:` line, that value is updated. If
   `references/KAIROS.md` exists and has a leading frontmatter `version`, that is
   updated too. The target version is the **greater** of `package.json` version
   and the latest **stable** `vX.Y.Z` tag in the repo (no prerelease suffix in
   the tag), defaulting to `1.0.0` when no stable tag exists. That way a new
   release number is applied to skills **before** the new tag exists.

**Scope limit:** Only `skills/<name>/...` where `<name>` is a direct child of
`skills/` is processed. Deeper layouts (for example `skills/.system/foo/SKILL.md`)
are **not** updated by this script unless the script is extended.

**Verification:** `npm run version:check-skills` runs the same logic in `--check`
mode and exits non-zero on mismatch. **Integration** runs this; **pre-commit**
runs it when `package.json`, `skills/`, or `src/embed-docs/mem/` is staged.

---

## 5. Edge cases and troubleshooting

- **Dirty working tree:** Stash or commit unrelated changes first. The release
  branch should only contain version-bump artifacts (and anything the user
  explicitly includes).

- **Existing `release/*` branch:** Warn and ask whether to reuse or delete it.

- **Pre-release to stable:** If the current version is for example `3.3.0-rc.1`
  and the user wants stable, `npm run release:patch` is the usual path (npm drops
  the prerelease and advances the patch level).

- **`version:check-skills` fails (pre-commit or CI):** This means embedded
  versions are out of sync with targets, not necessarily that `sync` crashed.
  1. Run `git fetch --tags` so “latest stable tag” is correct locally.
  2. Run `npm run version:sync-skills`.
  3. Re-stage: `git add skills/ src/embed-docs/mem/` (and `package.json` /
     `package-lock.json` if you changed them).
  4. Run `npm run version:check-skills` again before committing.

- **`version:sync-skills` throws or exits non-zero:** Fix the underlying error
  (invalid `package.json`, missing `version` field, unreadable files, and so on),
  then re-run sync. Do not commit a broken bump.

- **New skill file under `skills/<dir>/`:** Ensure `SKILL.md` has the expected
  `version:` metadata line (two-space indent) so the script can update it; same
  for `references/KAIROS.md` frontmatter if you use it.
