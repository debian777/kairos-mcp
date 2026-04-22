---
name: repo-build-test
description: "Repository build/test contract for kairos-mcp. Use npm scripts only, always deploy before tests, and never run direct jest/npx jest."
---

# Repo build and test workflow (kairos-mcp)

Use this skill whenever you need to build, deploy, or test this repository.
This skill is derived from `CONTRIBUTING.md` and is the authoritative execution
path for agent runs in this repo.

## Core rules (source of truth)

- Always install dependencies with `npm ci` before first build/test.
- Always deploy before tests: tests run against the running dev server.
- Use npm scripts as the primary interface for build/deploy/test.
- Prefer running one test file while iterating, then run broader suites.
- Authoritative details live in `CONTRIBUTING.md` sections:
  - `## Developer commands`
  - `## Setup from clone to passing tests`
  - `## PR requirements`

## Hard stop rule

- **Do not run direct Jest commands** (for example `npx jest`, `jest ...`, or
  `node .../jest.js`) as the default testing path in this repo.
- Use `npm run dev:test` (optionally with a file filter) instead.

## Canonical execution sequence

1. Install dependencies:

```bash
npm ci
```

2. Deploy dev stack with current code:

```bash
npm run dev:deploy
```

3. Run focused test(s) during iteration:

```bash
npm run dev:test -- tests/integration/<file>.test.ts
```

4. Run full test suite before handoff/PR:

```bash
npm run dev:test
```

5. Run full validation when requested:

```bash
npm run handoff
```

## Supporting scripts

Use the repository's own npm scripts for build, env controls, and lint/quality.
Do not restate or fork those command lists here; read `CONTRIBUTING.md` to
avoid drift.

## Auth variants

Without Keycloak:

```bash
AUTH_ENABLED=false npm run dev:test
```

With Keycloak:

```bash
npm run dev:deploy
KEYCLOAK_URL= AUTH_ENABLED=true npm run dev:test -- \
  tests/integration/auth-keycloak.test.ts
```

## Decision policy for agents

- If the user asks to run tests, run `npm run dev:deploy` first unless they
  explicitly ask to skip deploy.
- If a command path conflicts with this skill, follow this skill for repo
  correctness and explain why.
- If tests fail, report the failing suites and likely root causes; do not mask
  failures by switching to ad hoc direct Jest execution.

## Fork portability

- For forks of KAIROS, keep the same policy (deploy before test; use project
  scripts, not ad hoc direct Jest).
- If script names differ in the fork, map to the fork's equivalent scripts and
  document the mapping before execution.
