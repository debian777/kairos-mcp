---
kind: dependency_management
name: npm-based dependency management with Renovate and Dependabot
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - renovate.json
    - .github/dependabot.yml
    - Dockerfile
    - Dockerfile.stdio
    - helm/kairos-mcp/Chart.yaml
---

This repository uses a single-package npm workflow managed by npm (lockfile v3) with automated updates from two complementary systems: Renovate (primary, feature-rich) and GitHub Dependabot (fallback for rapid vulnerability response).

**Package manifest and lockfile**
- `package.json` declares runtime dependencies (`@modelcontextprotocol/sdk`, `express`, `react`, `zod`, `redis`, `@qdrant/js-client-rest`, etc.) and devDependencies (TypeScript, Jest, Vitest, Playwright, ESLint, Vite). The package is published as the public npm package `@debian777/kairos-mcp` with CLI binaries `kairos` and `kairos-mcp` pointing at `dist/cli/index.js`.
- `package-lock.json` (lockfileVersion 3) pins every transitive dependency to exact versions and integrity hashes; it is committed to the repo so CI and local installs are deterministic. No vendoring directory exists — dependencies are installed from the public npm registry.
- `engines.node = ">=24.0.0"` enforces a minimum Node version via `.nvmrc`/tooling.
- `overrides` in `package.json` force patched versions of vulnerable transitive deps (`path-to-regexp`, `glob`, `minimatch`, `tar`, `fast-uri`, `js-yaml`, `markdown-it`) across the entire tree.

**Renovate (primary updater)**
- `renovate.json` configures Renovate as the main update engine:
  - Groups all npm updates into one PR (`groupName: "npm"`, commit prefix `deps(npm)`), and similarly groups GitHub Actions, Dockerfiles, docker-compose, Helm Chart.yaml, and Helm values image tags.
  - Enables OSV vulnerability alerts and immediate PR creation for security categories, with automerge for patch/minor security fixes when CI passes.
  - Pins Docker image digests (`pinDigests: true`) for supply-chain immutability.
  - Custom regex managers scan `helm/kairos-mcp/values.yaml` for split `repository`/`tag` pairs and inline `image:` references, excluding the app image `quay.io/debian777/kairos-mcp` (managed by release sync scripts instead).
  - Global schedule is `before 10am`; security updates bypass scheduling.

**Dependabot (vulnerability-focused fallback)**
- `.github/dependabot.yml` runs daily for npm, GitHub Actions, and Docker ecosystems. It bundles all npm updates into a single group (`npm-dependencies`) and ignores TypeScript major bumps (peer-type constraint with typescript-eslint 8.x). This provides faster-than-weekly vulnerability PRs even when Renovate is disabled.

**Docker build integration**
- `Dockerfile` and `Dockerfile.stdio` use a multi-stage build that either installs the published `@debian777/kairos-mcp` package from the npm registry (Release target) or installs from a locally built tarball (dev/debug targets), reusing the same `overrides` block to keep transitive vulns patched inside containers.

**Helm chart dependencies**
- `helm/kairos-mcp/Chart.yaml` plus `Chart.lock` manage Helm subchart dependencies; Renovate's `helmv3` manager keeps these in sync alongside the rest of the dependency surface.

**Conventions and rules for developers**
- Add new runtime/dev dependencies only in `package.json`; never edit `package-lock.json` manually — let Renovate/Dependabot regenerate it.
- Prefer caret (`^`) ranges in `dependencies`/`devDependencies` so Renovate can propose minor/patch upgrades automatically.
- Use `overrides` sparingly and only for known vulnerabilities in transitive deps; document the CVE reason in the PR.
- Do not pin Docker image tags directly in `values.yaml` unless they are external images; the custom regex manager will bump them, but the app image tag is intentionally excluded because it is synchronized by release scripts.
- When updating Node, follow the `engines` field and the comment in `renovate.json` about manual bumps for `setup-node` node-version strings in workflows.