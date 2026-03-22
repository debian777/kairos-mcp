# GitHub Actions – workflow design

## Overview

```mermaid
flowchart LR
  subgraph triggers["Triggers"]
    PR[PR → main]
    PUSH[Push → main]
    TAG[Tag push v*.*.*]
    MANUAL[Manual dispatch]
  end

  subgraph workflows["Workflows"]
    INT(Integration)
    RTAG(Release tag on version bump)
    REL(Release)
    PNPM(Publish npm)
    PIMG(Publish image in Release)
    PCONT(Publish Container)
  end

  PR --> INT
  PUSH --> INT
  PUSH --> RTAG
  TAG --> INT
  TAG --> REL
  RTAG -->|"if version > latest tag"| TAG
  REL --> PNPM
  PNPM --> PIMG
  MANUAL --> INT
  MANUAL --> PNPM
  MANUAL --> PCONT

  classDef trigger fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef integration fill:#dcfce7,stroke:#16a34a,color:#166534
  classDef release fill:#fef3c7,stroke:#d97706,color:#92400e
  class PR,PUSH,TAG,MANUAL trigger
  class INT integration
  class RTAG,REL,PNPM,PIMG,PCONT release
```

**Release path (normal flow):** Version-bump PR merged to main → **Release tag on version bump** runs; if `package.json` version &gt; latest tag, it pushes that tag → **Release** runs on tag push (publish npm → publish Docker → create GitHub Release).

**Integration:** Runs on every PR and push to main (and on tag push to re-verify the released ref). Manual run available.

**PR/MR tooling:** This repo uses the GitHub CLI (**gh**) for PRs. For GitLab MRs use **glab**. KAIROS protocols: *GitHub PR with gh* (create/track PRs with `gh`), *GitLab MR with glab* (create/track MRs with `glab`).

**Dependabot:** Auto-merge is enabled at repository level (Settings → General → Pull Requests → Allow auto-merge). On each Dependabot PR, use **Enable auto-merge**; the PR will merge when required status checks pass. No workflow is used for this.

**Manual-only:** Publish npm and Publish Container are for ad-hoc republish/debug; they use `package.json` version when not run from a tag.

## Workflows and job dependencies

Each workflow is made of one or more **jobs**. Arrows show `needs:` — the target job runs only after the source job succeeds.

```mermaid
flowchart TB
  subgraph INT_WF["Integration (integration.yml)"]
    J_CHK[checks]
    J_INT[integration]
    J_PASS[integration-pass]
    J_CHK --> J_PASS
    J_INT --> J_PASS
  end

  subgraph RTAG_WF["Release tag on version bump (release-tag-on-version-bump.yml)"]
    J_TAG[tag-release]
  end

  subgraph REL_WF["Release (release.yml)"]
    J_NPM[publish-npm]
    J_DOCKER[publish-docker]
    J_REL[create-release]
    J_NPM --> J_DOCKER --> J_REL
  end

  subgraph PNPM_WF["Publish npm (publish-npm.yml)"]
    J_PNPM[publish]
  end

  subgraph PCONT_WF["Publish Container (publish-container.yml)"]
    J_PCONT[publish]
  end

  classDef jobDefault fill:#f1f5f9,stroke:#64748b,color:#1e293b
  classDef jobNeeds fill:#fef3c7,stroke:#d97706,color:#92400e
  class J_CHK,J_INT,J_PASS,J_TAG,J_PNPM,J_PCONT jobDefault
  class J_NPM,J_DOCKER jobNeeds
```

| Workflow | Job(s) | Dependencies |
|----------|--------|--------------|
| Integration | `checks`, `integration` (parallel) → `integration-pass` | `integration-pass` needs both `checks` and `integration` |
| Security | `dependency-review`, `npm-audit`, `codeql` | — (parallel jobs) |
| Release tag on version bump | `tag-release` | — |
| Release | `publish-npm` → `publish-docker` → `create-release` | `publish-docker` and `create-release` need `publish-npm`; `create-release` needs `publish-docker` |
| Publish npm | `publish` | — |
| Publish image (in Release) | `publish-docker` | after `publish-npm` |
| Publish Container | `publish` | — |

## Integration workflow

### Secrets and variables

The integration workflow uses **optional secrets:** `OPENAI_API_KEY` (embedding tests), `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_DB_PASSWORD`, `SESSION_SECRET`. In the workflow they are referenced as `${{ secrets.OPENAI_API_KEY }}` etc. Non-sensitive values use **repository variables** as `${{ vars.VAR_NAME }}`. If optional secrets are not set, the job uses fixed defaults for Keycloak and generates `SESSION_SECRET` so the job runs without any secrets.

**Triggers:** `push` tags `v*.*.*`, `workflow_dispatch` (optional force input).

**Actions → Integration → Run workflow** (workflow_dispatch).

**Jobs:** **`checks`** runs version/skills lint, `npm ci`, Playwright browsers, then **TypeScript + Knip + UI tests in parallel** (`scripts/run-parallel-checks-ci.mjs`). **`integration`** brings up Docker infra, overlaps **`npm ci` + Playwright install** with container warmup (Playwright is required again on this runner for **browser E2E** tests under `tests/integration/`, e.g. `cli-auth-browser-login.e2e.test.ts`), waits for Redis/Qdrant/Postgres/Keycloak **in parallel** (`scripts/wait-for-infra-ci.sh`), configures Keycloak, builds the tgz and release-equivalent image, runs Trivy, installs from tgz, starts the app, and runs **`dev:test`**. **`integration-pass`** runs with `if: always()` and fails unless both upstream jobs succeeded — use it as the **single required status check** (name: **Integration workflow passed**) so a green `integration` alone cannot merge while `checks` is red.

**Caching:** Both jobs use the same **`~/.cache/ms-playwright`** cache key (`runner.os` + `package-lock.json` hash). **`integration`** also restores/saves **Docker infra** images (`compose.yaml` hash).

**Job summary:** Most steps append a **Vitest-style** block to `$GITHUB_STEP_SUMMARY` (`##` title, `### Summary`, ✅/❌ bullets) via `scripts/run-with-github-summary.mjs`. The parallel checks step appends tsc and Knip summaries after all three commands finish. **Vitest** adds its own “Vitest Test Report” when `CI=true` (`vitest.config.ts`). **Jest** integration tests append “Jest integration tests” via `tests/reporters/jest-github-summary-reporter.cjs` when `GITHUB_STEP_SUMMARY` is set (`scripts/run-env.sh`).

## Release: only acceptable final output

After a version-bump PR is merged to main, the **only** path that publishes is: **Release tag on version bump** (creates tag if needed) → **Release** workflow (publish-npm → publish-docker → create GitHub Release).

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#e2e8f0', 'primaryTextColor':'#1e293b', 'primaryBorderColor':'#64748b', 'lineColor':'#64748b', 'secondaryColor':'#fef3c7', 'tertiaryColor':'#dcfce7' }}}%%
sequenceDiagram
  participant Main as Main #e2e8f0
  participant RTAG as Release tag on version bump #fef3c7
  participant REL as Release workflow #fef3c7

  Main->>RTAG: push to main (after merge)
  RTAG->>RTAG: package.json version > latest tag?
  alt version increased
    RTAG->>RTAG: git push origin v<version>
  RTAG->>REL: tag push v*.*.*
  REL->>REL: Publish npm job
  REL->>REL: Publish image job (needs: publish-npm)
  REL->>REL: Create GitHub Release (needs: publish-docker)
  else no bump
    RTAG->>RTAG: No tag needed
  end
```

## Release tag on version bump

`release-tag-on-version-bump.yml` runs after **Integration** completes (any branch) or via **manual dispatch**.

- **Main:** Full releases (`vX.Y.Z`) and pre-releases (`vX.Y.Z-pre.N`) — creates and pushes the tag when `package.json` version is **greater** than the latest existing stable tag. Same as before.
- **Any other branch:** **Beta only** — creates the tag only if the version contains `-beta.` (e.g. `3.2.0-beta.0`) and that tag does not already exist. Full/pre releases are not created from non-main branches.
- **Manual trigger (Actions → Release tag on version bump → Run workflow):** Provide **ref** (branch or SHA, e.g. `feat/seamless-kairos-opus-4.6-max`). Beta only: tags the commit if `package.json` version is a beta and the tag does not exist. Use when you want a beta release from a feature branch without merging to main. The ref does not need to have passed Integration first.

**Flow:** When a tag is created (by this workflow), it triggers the **Release** workflow (npm → Docker → GitHub Release).

**Required for Release to run:** GitHub does not trigger workflows when a tag is pushed by another workflow using the default `GITHUB_TOKEN`. To have the **Release** workflow run after the tag is pushed, add a **Personal Access Token (PAT)** with `repo` scope as repository secret **`GH_PAT`** (e.g. `gh secret set GH_PAT` or Settings → Secrets → Actions). Without it, the tag is still pushed but Release will not run (run it manually from Actions → Release → Run workflow with the new tag ref).

Branch protection does not block tag pushes by default. If you use “Restrict pushes that create matching tags”, allow this repo’s GitHub Actions to create tags or run the tag step with a token that can push tags.
## Release workflow (tag → npm + Docker)

**Release** (`release.yml`) runs on **tag push** `v*.*.*` or `v*.*.*-*` (e.g. `v3.0.1`, `v3.0.1-beta.4`). It is the **only** path that publishes. Jobs run in order:

1. **Publish npm** — lint, knip, prepare:publish (tgz + test install), `npm publish` with `latest` or `beta` tag (OIDC, no NPM_TOKEN).
2. **Publish image** — runs after npm succeeds; builds and pushes `debian777/kairos-mcp:<version>` and `latest` to Docker Hub, and `quay.io/<QUAY_NAMESPACE>/kairos-mcp:<version>` and `latest` to Quay.
3. **Create GitHub Release** — runs after the image job; creates the GitHub Release for the tag with generated release notes.

**Required secrets:** `DOCKER_USERNAME`, `DOCKER_PASSWORD` (Docker Hub); `QUAY_USERNAME`, `QUAY_PASSWORD` (Quay login). **Required repository variable:** `QUAY_NAMESPACE` (Quay namespace used in image tags, e.g. your Quay username). Without them, the image job fails.

The Release workflow uses **npm Trusted Publishers** (OIDC) for publish; no `NPM_TOKEN` is required when Trusted Publisher is configured.

## Manual publish workflows (ad-hoc only)

- **Publish npm** (`publish-npm.yml`): **workflow_dispatch** only; uses `package.json` version.
- **Publish Container** (`publish-container.yml`): **workflow_dispatch** only; builds and pushes to Docker Hub and Quay. Uses the same secrets and `QUAY_NAMESPACE` variable as Release.

Use only for one-off republish or debugging. Normal releases go through the Release workflow only.

## Docker: release vs local dev

- **Release** (CI and `npm run docker:build`): **Dockerfile** installs the published package from npm (`@debian777/kairos-mcp@${PACKAGE_VERSION}`). No source build; version is a required build-arg. The Release workflow passes the tag version.
- **Local dev** (build from source): **Dockerfile.dev** copies source and runs `npm run build` inside the image. Use `npm run docker:build:dev` or `docker build -f Dockerfile.dev -t kairos-mcp:dev .`. No publish required.
