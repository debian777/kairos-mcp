---
kind: build_system
name: Node.js Monorepo Build, Packaging & Release Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - Dockerfile
    - compose.yaml
    - scripts/deploy-run-env.sh
    - .github/workflows/release.yml
    - .github/workflows/reusable-publish-npm.yml
    - scripts/helm-sync-app-version.mjs
    - scripts/build-sync-skill-versions.mjs
    - helm/kairos-mcp/Chart.yaml
    - vite.config.ts
    - tsconfig.json
---

## What system/approach is used

KAIROS MCP Server uses a single-package Node.js monorepo built with TypeScript + Vite (for the embedded React UI). The build pipeline is orchestrated through npm scripts, Docker multi-stage builds, and GitHub Actions workflows. There is no Makefile — all orchestration lives in package.json scripts and shell helpers under scripts/.

- Build toolchain: TypeScript compiler (tsc) for server/CLI code, Vite for the embedded UI bundle, ESLint + Knip for static analysis, Jest/Vitest for tests.
- Packaging: Single npm package (@debian777/kairos-mcp) published from a tarball produced by npm pack; the same artifact is consumed by the release Docker image via deps-local stage.
- Containerization: Multi-stage Dockerfile with two runtime targets — runtime (install from npm registry) and runtime-ci (install from .ci/docker/package.tgz), both producing identical final layers.
- Local dev orchestration: scripts/deploy-run-env.sh manages environment profiles (dev, dev_simple, dev_stdio, prod), process lifecycle, health checks, snapshot seeding, and test execution.
- CI/CD: GitHub Actions workflows handle lint/security pre-checks, npm publish, Docker build+push to Docker Hub + Quay, image signing (cosign), SBOM generation (CycloneDX), Trivy scanning, Helm chart testing, and GitHub Release creation.

## Key files and packages

- package.json — npm script surface: build, prebuild, pack, docker:*, release:*, dev:*, test:*, lint:*, version:sync, Helm/compose version sync helpers.
- Dockerfile — multi-stage release image; runtime target installs published npm package, runtime-ci installs from local tgz.
- compose.yaml — Docker Compose stack defining Qdrant, optional Valkey/Redis, Postgres, Keycloak, and the KAIROS app service with profile-based composition.
- scripts/deploy-run-env.sh — environment manager: build/start/stop/status/test/logs/health per ENV profile, PID/log management, dependency health checks, CI snapshot seeding/import.
- .github/workflows/release.yml — single release pipeline triggered on v*.*.* tags: npm publish → Docker build/push (multi-arch) → cosign sign → CycloneDX SBOM → Trivy scan → GitHub Release.
- .github/workflows/reusable-publish-npm.yml — reusable npm publish job with OIDC token auth, SBOM upload, force/existing-version controls.
- scripts/helm-sync-app-version.mjs / scripts/build-sync-skill-versions.mjs — keep Helm chart appVersion and skill references in sync with package.json version.
- helm/kairos-mcp/Chart.yaml + values*.yaml — Helm chart packaging for Kubernetes deployment alongside the npm/Docker artifacts.
- tsconfig.json, tsconfig.ui.json, vite.config.ts — TypeScript compilation and Vite UI bundling configuration.

## Architecture and conventions

### Versioning strategy
- A single source of truth: package.json.version drives everything.
- npm run version:sync updates Helm chart appVersion, Compose image tag, and embedded skill references atomically.
- Pre-release versions use SemVer prerelease identifiers (rc, beta, pre) and are marked as GitHub pre-releases automatically based on tag hyphenation.

### Build phases
1. Prebuild (prebuild): runs verify:clean, skills:sync-install-refs, embed-docs generator (build-embed-docs.ts), and skill version sync.
2. Lint (optional during DOCKER_BUILD=false): ESLint + Knip + markdown/mermaid linters.
3. UI build (ui:build): Vite produces static assets bundled into the dist tree.
4. TypeScript compile (tsc): compiles src/ into dist/, makes CLI entry executable.
5. Pack (pack): npm pack produces a tarball; build:tgz wraps it with a deterministic filename for reproducible publishing.

### Container image policy
- Production images install from the npm registry (no source build inside Docker), ensuring parity between locally published packages and containerized releases.
- Two identical runtime stages differ only in how dependencies are resolved (registry vs local tgz), enabling integration tests to validate the exact tarball being published.
- Images are signed with cosign (keyless) and scanned with Trivy (CRITICAL/HIGH fail).

### Local development model
- Environment profiles (dev, dev_simple, dev_stdio, prod) are selected via the ENV variable and load .env plus .env.<ENV> overrides.
- dev_simple auto-starts an embedded Qdrant binary; dev expects external Keycloak/Qdrant; dev_stdio runs without HTTP listeners.
- Health checks gate startup; CI mode auto-seeds and imports a Qdrant snapshot before running tests.

### CI workflow decomposition
- integration.yml / integration-simple.yml / integration-stdio.yml — spin up infra, build, run full test matrix against different transports.
- publish-container.yml — standalone container publish (used by release).
- helm-chart.yml / helm-version-bump.yml — Helm chart validation and version bump automation.
- security.yml — CodeQL + Trivy on source and containers.
- release-tag-on-version-bump.yml — creates a version tag after a version-bump PR merges to main, triggering the release pipeline.

## Rules developers should follow

- Never edit version numbers manually — use npm run release:patch|minor|major|rc|beta|pre which bumps package.json and runs version:sync to propagate across Helm, Compose, and skills.
- Do not bypass the prebuild step — npm run build enforces prebuild first; embedding docs and skill version sync must stay in sync or the build will fail.
- Keep Docker targets in sync — any change to the runtime-ci stage must be mirrored in runtime (and vice versa); they intentionally duplicate to guarantee parity.
- Use deploy-run-env.sh via npm scripts — direct invocation is blocked unless ENV= is set; prefer npm run dev:start|test|restart etc.
- Helm values must match Compose defaults — when changing ports or env vars, update both compose.yaml and helm/kairos-mcp/values*.yaml together.
- Release flow is tag-driven — pushing a v*.*.* tag triggers the full release pipeline; do not push tags from feature branches.
- Integration tests require a clean working tree — ensure-coding-rules enforces no unstaged/staged changes and requires a passing test report referencing the current commit.