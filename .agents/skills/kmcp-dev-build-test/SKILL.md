---
name: kmcp-dev-build-test
description: >-
  kairos-mcp: authoritative build, deploy, and test path. npm scripts only;
  always dev:deploy before dev:test; never use bare npx jest/jest as default.
  Invoke for CI parity, integration tests, handoff, or any "run tests" request.
---

# Build, deploy, and test (kairos-mcp)

**Repository:** `kairos-mcp` — Node 24 LTS minimum, TypeScript, Qdrant, Redis, optional Keycloak.
**Agent contract:** [`AGENTS.md`](../../../AGENTS.md). **Adapter execution (shipped skill):**
[`skills/kairos/SKILL.md`](../../../skills/kairos/SKILL.md). **Skill index:**
[`.agents/skills/README.md`](../README.md) (`kmcp-dev-*`).

Use this skill whenever you need to **build**, **deploy**, or **test** this repository.
Derived from [`CONTRIBUTING.md`](../../../CONTRIBUTING.md); this file is the **authoritative**
execution path for agents in this worktree.

## Core rules (source of truth)

- In a **git worktree**, ensure **`.env*`** exists or will be copied from main, and that **`PORT`** / **`METRICS_PORT`** do not clash with another checkout on the same host; see **[`kmcp-dev-worktree-env`](../kmcp-dev-worktree-env/SKILL.md)** (first **`npm run dev:*`** that uses **`deploy-run-env.sh`** copies **`.env`** when missing).
- Always install dependencies with **`npm ci`** before first build/test.
- Always **deploy before tests**: integration tests expect a running dev stack.
- Use **npm scripts** as the only default interface for build, deploy, test, lint.
- Prefer one integration file while iterating, then broaden.
- Deep policy: **`CONTRIBUTING.md`** — `## Developer commands`, `## Setup from clone to passing tests`, `## PR requirements`.

## Hard stop

- **Do not** use direct Jest invocations (`npx jest`, `jest …`, `node …/jest.js`) as the default path.
- **Do** use `npm run dev:test` (with optional file filter).

## Canonical sequence

1. **`npm ci`**
2. **`npm run dev:deploy`**
3. **`npm run dev:test -- tests/integration/<file>.test.ts`** (iterate)
4. **`npm run dev:test`** (pre-PR / handoff)
5. **`npm run handoff`** when full maintainer validation is requested

## Auth variants

Without Keycloak:

```bash
AUTH_ENABLED=false npm run dev:test
```

With Keycloak (example):

```bash
npm run dev:deploy
KEYCLOAK_URL= AUTH_ENABLED=true npm run dev:test -- \
  tests/integration/auth-keycloak.test.ts
```

## Agent policy

- User asks to run tests → run **`npm run dev:deploy`** first unless they explicitly skip deploy.
- On conflict with ad hoc commands → follow this skill and state why.
- On failure → report suites and likely causes; do not "green" by switching to bare Jest.

## Fork portability

Same policy for forks: deploy-before-test, npm scripts. If script names differ, map equivalents and document before running.

## Related maintainer skills

- **[`kmcp-dev-worktree-env`](../kmcp-dev-worktree-env/SKILL.md)** — `.env*` in worktrees; sync from main.
- **[`kmcp-dev-mcp-qa-e2e`](../kmcp-dev-mcp-qa-e2e/SKILL.md)** — MCP-first QA against KAIROS-DEVELOPMENT.
- **[`kmcp-dev-bugfix-ship`](../kmcp-dev-bugfix-ship/SKILL.md)** — bug report → fix → PR → CI.
- **[`kmcp-dev-release-semver`](../kmcp-dev-release-semver/SKILL.md)** — semver release branch flow.
