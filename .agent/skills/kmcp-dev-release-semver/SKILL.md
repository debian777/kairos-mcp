---
name: kmcp-dev-release-semver
description: >-
  kairos-mcp: semver release through npm/Docker — evidence-based bump, user confirms,
  branch + commit + PR to main, babysit CI until merge, then confirm tag + Release
  workflow (no manual v* push). Triggers: bump version, cut release, RC, version PR,
  “publish”, “released”.
---

# Version bump and release (kairos-mcp)

**Repository:** `kairos-mcp`. **Skill index:** [`.agent/skills/README.md`](../README.md).
**Tag automation:** `.github/workflows/release-tag-on-version-bump.yml` (see
**[`.github/workflows/README.md`](../../../.github/workflows/README.md)**).
**Build/test after merge:** [`kmcp-dev-build-test`](../kmcp-dev-build-test/SKILL.md).

---

## Expected outcome (definition of done)

**Released** means the package (and container image, when Release succeeds end-to-end)
is published from CI — not merely that `package.json` changed locally.

| Stage | Done when |
|-------|-----------|
| Version bump | `npm run release:<type>` (or equivalent) and **`npm run version:sync`** artifacts are correct. |
| Land on `main` | Version-bump commit is merged to **`main`** (pre-commit may forbid committing directly to `main`; use a branch + PR). |
| Tag | **`Release tag on version bump`** creates **`v${version}`** after required Integration workflows succeed (see workflows README). |
| Publish | **`Release`** runs on that tag: npm publish, Docker, GitHub Release. |

**Do not treat “commit + push” as the end state** when the user asked for a **released**
RC or stable: continue through **open PR → green checks → merge → confirm tag and
Release workflow → verify on npm** (section 3.4).

**npm dist-tag:** In **`.github/workflows/reusable-publish-npm.yml`**, any version
string containing **`-`** is published with dist-tag **`beta`**; plain **`X.Y.Z`**
uses **`latest`**. Consumers may pin **`@debian777/kairos-mcp@<exact-version>`** or
use **`@beta`** where appropriate.

---

## Paths

- **Minimal (version bump only):** If the user explicitly wants **only** a local/working-tree bump (no registry), run **`npm run release:<type>`** (includes **`version:sync`**) and stop after stating that nothing ships until merged to **`main`**.
- **Default (ship a version):** Full path below: bump → branch → commit → push → PR → **babysit** (3.4) until **`npm view`** shows the version.

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

| Signal | Type | `npm run` target |
|--------|------|------------------|
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

Confirm semver level and prerelease flavor if any. After confirmation, run **section 3**
without re-asking. If the user already stated **“released” / “publish” / “to npm”**,
assume **ship** (full definition of done), not bump-only.

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

Branch names **`release/<version>`** or **`chore/bump-<version>`** are both fine;
**`main`** is the merge target for shipping.

### 3.3 Commit, push, PR

Stage everything **`release:*`** / **`version:sync`** touched (at minimum **`package.json`**, **`package-lock.json`**, **`compose.yaml`**, **`src/embed-docs/mem/`**, top-level **`skills/*/SKILL.md`** as applicable):

```bash
git add package.json package-lock.json compose.yaml src/embed-docs/mem/ skills/
git status
git commit -m "release: $VERSION"
git push -u origin "$(git branch --show-current)"
gh pr create --base main --head "$(git branch --show-current)" \
  --title "release: $VERSION" \
  --body "Version bump to $VERSION. Merges to \`main\` so **Release tag on version bump** can tag \`v$VERSION\` and run the **Release** workflow (npm + Docker)."
```

Present the **PR URL** clearly:

```bash
gh pr view --json url -q .url
```

**Do not create or push `refs/tags/v*`.** Tags are created after merge when Integration succeeds; **pre-push** blocks manual tags.

### 3.4 Babysit until published

Until **`npm view @debian777/kairos-mcp@${VERSION} version`** returns **`${VERSION}`**, the release is not finished.

1. **PR exists** — If the branch is pushed but no PR: `gh pr create` as in 3.3, or `gh pr list --head '<branch>'`.
2. **Checks** — Watch **Integration** and **Integration Simple** on the PR; fix failures or ask the user only for blockers you cannot clear (branch protection, secrets).
3. **Merge** — When policy allows, prefer **`gh pr merge <n> --squash --auto --subject "release: $VERSION"`** so merge happens when required checks pass. If **`--auto`** is disallowed, tell the user exactly what is blocking (reviews, required statuses).
4. **Post-merge** — Confirm **`Release tag on version bump`** ran and pushed **`v$VERSION`**, then **Release** completed (Actions UI or `gh run list --workflow=release.yml`).
5. **Verify registry** — `npm view @debian777/kairos-mcp@${VERSION} version` (and Docker only if that is part of the user’s ask).

Treat this loop like a **merge-ready PR babysit**: no silent stop after “pushed branch”
when the stated outcome is **released**.

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
- **Tag skipped on main** — **Release tag on version bump** compares **`package.json`** to the latest **stable** `vX.Y.Z` tag only; if logic skips tagging, read the workflow log and **`.github/workflows/README.md`** before changing version strategy.

---

## Related

- **[`kmcp-dev-build-test`](../kmcp-dev-build-test/SKILL.md)** — validate after large release merges.
- **[`kmcp-dev-bugfix-ship`](../kmcp-dev-bugfix-ship/SKILL.md)** — if a release uncovers a production defect.
