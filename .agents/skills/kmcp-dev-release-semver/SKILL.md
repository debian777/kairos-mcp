---
name: kmcp-dev-release-semver
description: >-
  kairos-mcp: deterministic semver release. Inspect commits since last stable v*
  tag; recommend patch/minor/major with evidence; user confirms; release/* branch,
  npm run release:<type>, PR to main, no manual v* tag (CI tags after merge).
  Triggers: bump version, bump RC, bump prerelease, cut release, version-bump PR,
  release branch, next version, semver bump, release:rc, release:minor, release:patch,
  release:major, npm version, version bump, bump to rc, bump to beta.
---

# Version bump and release (kairos-mcp)

**Repository:** `kairos-mcp`. **Skill index:** [`.agents/skills/README.md`](../README.md).
**Tag automation:** `.github/workflows/release-tag-on-version-bump.yml` (see
**[`.github/workflows/README.md`](../../../.github/workflows/README.md)**).
**Build/test after merge:** [`kmcp-dev-build-test`](../kmcp-dev-build-test/SKILL.md).

Releases work **with or without** stepping through every narrative below.

- **Minimal path:** `npm version <type> --no-git-tag-version` or **`npm run release:<type>`**, then **`npm run version:sync-skills`** when you did not use a **`release:*`** script → branch, commit, push, open PR yourself.
- **Full skill path:** judgment on semver → confirmation → scripted branch + PR + explicit “no local tag” reminder.

---

## 1. Choose next version type (evidence first)

Inspect commits since the latest **stable** tag (or all commits when none):

```bash
STABLE_TAG=$(git tag --sort=-v:refname | rg '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)
[ -n "$STABLE_TAG" ] && git log "${STABLE_TAG}..HEAD" --oneline || git log --oneline
```

Deliver before any bump:

1. **Verified facts** — commit categories, API/MCP schema surface changes, release-note signals.
2. **Inference** — why **`patch`**, **`minor`**, or **`major`** (or prerelease).
3. **Uncertainty** — what would change the call.

| Signal | Type | npm target |
|--------|------|------------|
| `BREAKING CHANGE` / `feat!:` / `fix!:` | **major** | `release:major` |
| `feat:` (backward-compatible) | **minor** | `release:minor` |
| `fix:` / `docs:` / `chore:` / `refactor:` / `ci:` / `test:` | **patch** | `release:patch` / `release:bug` |
| Prerelease ask | **rc** / **beta** / **pre** | `release:rc` / `release:beta` / `release:pre` |

“Next RC” without level → recommend level first; prefer **`minor`** when new capability ships, **`major`** when contract likely breaks; ask only if still ambiguous.

Never present a bump as fact without commit evidence.

---

## 2. User confirmation

One-line format:

`Recommended: <patch|minor|major> because <impact>.`

Confirm semver level and prerelease flavor if any. After confirmation, run **§3** without re-asking.

---

## 3. Automated steps (post-confirmation)

From **repo root**, in order.

### 3.1 Sync main

```bash
git fetch origin main
git checkout main
git pull origin main
```

### 3.2 Release branch + npm target

```bash
git checkout -b release/next
npm run release:<type>
```

`<type>`: `major` | `minor` | `patch` | `bug` | `rc` | `pre` | `beta`.

```bash
VERSION=$(node -p "require('./package.json').version")
git branch -m release/next "release/$VERSION"
```

### 3.3 Commit, push, PR

```bash
git add package.json package-lock.json src/embed-docs/mem/ skills/
git commit -m "release: $VERSION"
git push -u origin "release/$VERSION"
gh pr create --base main --head "release/$VERSION" \
  --title "release: $VERSION" \
  --body "Version bump to $VERSION."
```

Present the **PR URL** clearly. Optional:

```bash
gh pr view --json url -q .url
```

**Do not create or push `refs/tags/v*`.** Tags are created after merge when Integration succeeds; **pre-push** blocks manual tags.

---

## 4. What `version:sync-skills` does

Implementation: **`scripts/build-sync-skill-versions.mjs`** (also **`prebuild`**).

1. **`src/embed-docs/mem/*.md`** — frontmatter **`version:`** ← **`package.json`** (including prerelease).
2. **`skills/<top-level>/SKILL.md`** (immediate children of **`skills/`**) — metadata **`version:`** and optional **`references/KAIROS.md`** frontmatter, using the **greater** of **`package.json`** version and latest **stable** `vX.Y.Z` tag (see script for edge cases).

**Scope:** Only **`skills/<name>/`** direct children; **`skills/.system/...`** is **not** auto-updated unless the script is extended.

**Check:** **`npm run version:check-skills`** (also pre-commit when relevant paths staged).

---

## 5. Edge cases

- **Dirty tree** — stash or commit unrelated work first.
- **Existing `release/*`** — confirm reuse vs delete with the user.
- **Prerelease → stable** — often **`npm run release:patch`** from an `-rc` line (npm semantics apply).
- **`version:check-skills` fails** — `git fetch --tags`; **`npm run version:sync-skills`**; re-stage **`skills/`**, **`src/embed-docs/mem/`**, version files; re-run check.
- **New skill under `skills/<dir>/`** — ensure **`version:`** metadata line exists where the script expects.

---

## Related

- **[`kmcp-dev-build-test`](../kmcp-dev-build-test/SKILL.md)** — validate after large release merges.
- **[`kmcp-dev-bugfix-ship`](../kmcp-dev-bugfix-ship/SKILL.md)** — if a release uncovers a production defect.
