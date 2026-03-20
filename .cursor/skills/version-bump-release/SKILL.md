---
name: version-bump-release
description: "Deterministic version bump and release workflow. Use when the user says: bump version, cut a release, create a release, version-bump PR, or similar release-related requests."
---

# Version Bump & Release

Releases work **with or without this skill**.

- **Without skill:** Run `npm version <type> --no-git-tag-version` (or use the repo’s `npm run release:<type>` targets), then `npm run version:sync-skills`, then do branch/commit/push/PR yourself.
- **With skill:** The skill helps (1) choose the next version type, (2) get your confirmation, and (3) automate the rest.

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

If confidence < 95%, ask the user.

---

## 2. User confirmation

**Before any version change, ask the user to confirm the version type (and value if helpful).**  
After confirmation, run the full automation below without further questions.

---

## 3. Automated steps (after confirmation)

Run from **repo root**, in order.

**3.1 Ensure latest main**

```bash
git fetch origin main
git checkout main
git pull origin main
```

**3.2 Create release branch and run release target**

Create a temporary branch, run the chosen npm target (it runs `npm version ... --no-git-tag-version` and `version:sync-skills`), then rename the branch to `release/<version>`:

```bash
git checkout -b release/next
npm run release:<type>
```

Replace `<type>` with one of: `major`, `minor`, `patch`, `bug`, `rc`, `pre`, `beta`.

Then rename the branch to the actual version:

```bash
VERSION=$(node -p "require('./package.json').version")
git branch -m release/next "release/$VERSION"
```

**3.3 Commit, push, open PR**

```bash
git add package.json package-lock.json src/embed-docs/mem/ skills/
git commit -m "release: $VERSION"
git push -u origin "release/$VERSION"
gh pr create --base main --head "release/$VERSION" \
  --title "release: $VERSION" \
  --body "Version bump to $VERSION."
```

**3.4 Show clickable PR URL**

After `gh pr create`, the CLI prints the PR URL. Present that URL clearly to the user (e.g. as a clickable link in your response). If you need to obtain it explicitly:

```bash
gh pr view --json url -q .url
```

**Do not create a git tag.** Tags are created when the version-bump PR is merged to `main` (`.github/workflows/release-tag-on-version-bump.yml`).

---

## 4. Edge cases

- **Dirty working tree:** Stash or commit unrelated changes first. The release branch should only contain version-bump artefacts (and any changes the user explicitly includes).
- **Existing `release/*` branch:** Warn and ask whether to reuse or delete it.
- **Pre-release → stable:** If current version is e.g. `3.3.0-rc.1` and the user wants stable, use `npm run release:patch` (strips prerelease and bumps patch).
- **Sync failures:** If `version:sync-skills` fails, fix the issue before committing.
