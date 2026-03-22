---
name: kairos-bug-fix
description: "Runs end-to-end bug fix for kairos-mcp from a bug report: reproduce on KAIROS live MCP, add a failing dev test, implement fix, deploy and test dev, open PR, monitor CI, iterate until green, then report merge-ready. Use when fixing KAIROS MCP bugs, working from reports/mcp-bug-*.md, or when the user asks for the KAIROS bug-fix workflow."
---

# KAIROS bug fix (from bug report)

**Input:** A bug report (path under `reports/` or pasted content). If none exists yet, create one first under `reports/` (for example `reports/mcp-bug-<slug>.md`) or use a separate bug-capture workflow if your environment provides one. This skill owns **fixing** the bug once the report exists.

**Authority:** Tool behavior on **live** is authoritative for “does the bug exist?” Local code and tests prove regression coverage after the fix.

---

## Flow (execute in order; loop where noted)

### 1. Confirm on KAIROS live MCP

- Read the bug report: tool name, arguments, expected vs actual, reproduction steps.
- **Reproduce using the live MCP server** (connected KAIROS tools), not by inferring from `src/` alone. Read each tool’s schema under the host’s MCP descriptors before calling.
- If live behavior matches the report → proceed. If not, stop and reconcile (stale report, env mismatch, or different server); do not “fix” code for an unconfirmed symptom.

### 2. Failing test in dev

- Add an **automated** test under `tests/` (or extend an existing one) that **fails on current main** and encodes the bug (minimal, deterministic).
- Run **only** that test against dev stack if practical, or run the narrowest `npm run` / vitest filter the repo supports, until the new test fails for the right reason.

### 3. Fix and confirm with tests

- Implement the minimal code change that addresses the root cause.
- Run the new test until it passes; run related tests if the change touches shared code.

### 4. Build and deploy dev

From repo root:

```bash
npm run dev:deploy && npm run dev:test
```

If the project’s full gate is required (per change scope), use `npm test` only if the repo’s checked-in documentation or agent rules require it.

### 5. Commit, push, PR

- Branch: `fix/<short-topic>` or team convention.
- Commit with a clear message (what broke, what changed).
- Push and open PR to `main` (`gh pr create` or equivalent).

### 6. Monitor if the PR succeeded

- Watch required checks (e.g. `gh pr checks <number> --watch`, or the Actions UI).

### 7. On failure → return to step 3

- If CI fails, fix code or tests, push, and repeat from **step 3** until checks pass or the user stops.

### 8. Report merge-ready

When CI is green, give the user a short **merge-ready** summary:

- Bug (one line) and confirmation it reproduced on live MCP.
- Test added (file + what it asserts).
- Fix (files / behavior).
- Verification: `dev:deploy` + `dev:test` (and anything else run).
- PR link and status (checks green).

---

## MUST / MUST NOT

**MUST**

- Treat live MCP reproduction as the gate before coding.
- Add a regression test before or alongside the fix (test must fail pre-fix when possible).
- Redact secrets in any pasted logs or PR text.

**MUST NOT**

- Close the loop on “looks fixed in code” without dev deploy + automated test signal.
- Compute or guess KAIROS challenge fields (`proof_hash`, `nonce`, run IDs); always echo server values per product rules.

---

## Optional reference

- Bug report template and filename convention: `reports/mcp-bug-*.md`.
