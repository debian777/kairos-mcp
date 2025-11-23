# Phase 4: Remove Leaderboard Functionality

> **Implementation Guide** — Follow AI Coding Rules strictly  
> **Status:** Ready for Implementation  
> **Dependencies:** Phase 1, 2, 3 must be complete (metrics must be functional)

---

## Overview

This document provides step-by-step instructions for removing all leaderboard functionality. Leaderboard is replaced by Prometheus metrics queries.

**What Phase 4 Delivers:**
- ✅ All leaderboard routes removed
- ✅ All leaderboard files deleted
- ✅ Leaderboard references removed from health routes
- ✅ Clean codebase without leaderboard dependencies

**What Phase 4 Does NOT Include:**
- ❌ Game service refactoring (Phase 5)
- ❌ Terminology changes (Phase 5)

---

## AI Coding Rules Compliance

**This implementation MUST follow the AI Coding Rules exactly:**

1. ✅ **CHECK LOCAL DOCUMENTATION** - Use only documented npm scripts from README.md
2. ✅ **ESTABLISH BASELINE** - Run tests, archive baseline, ensure 100% green
3. ✅ **CREATE ISOLATED BRANCH** - `feat/remove-leaderboard-phase4`
4. ✅ **WRITE 3' BULLET PLAN** - Scope, files, success criteria
5. ✅ **REPRODUCE OR SPECIFY TARGET** - Add tests first
6. ✅ **MINIMAL IMPLEMENTATION** - Smallest possible changes
7. ✅ **RUN FULL TEST SUITE** - All tests must pass
8. ✅ **HYGIENE** - Lint, format, no secrets, no dead code
9. ✅ **SINGLE FOCUSED COMMIT** - One logical change
10. ✅ **FINAL VERIFICATION** - Proof of work validation
11. ✅ **HANDOFF** - Summary, commands, test log, commit hash

---

## Pre-Implementation Checklist

### 1. Establish Baseline

```bash
npm run dev:test > reports/tests/baseline-$(date +%Y%m%d-%H%M%S).log 2>&1
git rev-parse HEAD > reports/tests/baseline-commit.txt
```

**CRITICAL: Only proceed if ALL tests pass with zero failures.**

### 2. Create Isolated Branch

```bash
git checkout -b feat/remove-leaderboard-phase4
```

---

## 3' Bullet Plan

### Scope
- Remove leaderboard routes from http-api-routes.ts
- Delete all leaderboard files (HTML, CSS, JS, API)
- Remove leaderboard references from health routes
- Remove leaderboard imports

### Files to Delete
- `src/resources/content/leaderboard.ts`
- `src/resources/content/leaderboard-html.ts`
- `src/resources/content/leaderboard-css.ts`
- `src/resources/content/leaderboard-js.ts`
- `src/services/game/leaderboard-api.ts`
- `src/services/game/leaderboard.ts`

### Files to Modify
- `src/http-api-routes.ts` - Remove leaderboard routes
- `src/http-health-routes.ts` - Remove leaderboard reference

### Success Criteria
- ✅ `npm run dev:build` succeeds
- ✅ `npm run dev:test` passes (all tests green)
- ✅ `/leaderboard` route returns 404
- ✅ `/api/leaderboard` route returns 404
- ✅ `/api/achievements` route returns 404
- ✅ Health route has no leaderboard reference
- ✅ All linting passes
- ✅ No broken imports

**Wait for acknowledgment if scope is unclear.**

---

## Implementation Steps

### Step 1: Remove Leaderboard Routes

**File:** `src/http-api-routes.ts`

Remove or comment out:

```typescript
// DELETE THESE ROUTES:

// Modern Leaderboard Interface for Humans
app.get('/leaderboard', (req, res) => {
  // ... DELETE THIS ENTIRE ROUTE
});

// Direct API endpoint for leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  // ... DELETE THIS ENTIRE ROUTE
});

// Direct API endpoint for achievements data
app.get('/api/achievements', async (req, res) => {
  // ... DELETE THIS ENTIRE ROUTE
});
```

**Also remove imports:**
```typescript
// DELETE THIS IMPORT:
import { leaderboardHtml } from './resources/content/leaderboard.js';
```

### Step 2: Remove Leaderboard Reference from Health Routes

**File:** `src/http-health-routes.ts`

Remove leaderboard from endpoints list:

```typescript
// BEFORE:
endpoints: {
  health: '/health',
  mcp: '/mcp',
  leaderboard: '/leaderboard'  // DELETE THIS LINE
}

// AFTER:
endpoints: {
  health: '/health',
  mcp: '/mcp'
}
```

### Step 3: Delete Leaderboard Files

**Delete these files:**
```bash
rm src/resources/content/leaderboard.ts
rm src/resources/content/leaderboard-html.ts
rm src/resources/content/leaderboard-css.ts
rm src/resources/content/leaderboard-js.ts
rm src/services/game/leaderboard-api.ts
rm src/services/game/leaderboard.ts
```

**Verify:** No broken imports remain.

### Step 4: Check for Remaining References

**Search for any remaining leaderboard references:**

```bash
grep -r "leaderboard" src/ --exclude-dir=node_modules
```

**If found:** Remove or update references as needed.

---

## Testing

### Step 1: Build

```bash
npm run dev:build
```

**Verify:** Build succeeds without errors.

### Step 2: Run Tests

```bash
npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
```

**CRITICAL: All tests MUST pass with zero failures.**

### Step 3: Manual Verification

```bash
# Start server
npm run dev:start

# Verify routes are removed (should return 404)
curl http://localhost:${PORT}/leaderboard
# Expected: 404 Not Found

curl http://localhost:${PORT}/api/leaderboard
# Expected: 404 Not Found

curl http://localhost:${PORT}/api/achievements
# Expected: 404 Not Found

# Verify health route
curl http://localhost:${PORT}/
# Should NOT mention leaderboard
```

### Step 4: Linting

```bash
npm run lint
```

**Fix all linting errors before committing.**

---

## Hygiene Checklist

- [ ] Run linter: `npm run lint` (all errors fixed)
- [ ] Remove all debug prints/console.logs
- [ ] Verify no broken imports
- [ ] Check no orphaned files
- [ ] Verify TypeScript compilation

---

## Commit

### Commit Message

```
feat(api): remove leaderboard functionality phase 4

- Remove /leaderboard, /api/leaderboard, /api/achievements routes
- Delete leaderboard HTML/CSS/JS files
- Delete leaderboard API and service files
- Remove leaderboard reference from health routes
- Leaderboard replaced by Prometheus metrics queries

Phase 4 removes leaderboard. Metrics provide all needed stats.
```

---

## Final Verification

- [x] Baseline archived and was 100% green
- [x] All tests pass
- [x] Leaderboard routes return 404
- [x] Health route updated
- [x] No broken imports
- [x] Linting passes

---

## Handoff

### One-Sentence Summary
Removed all leaderboard functionality: deleted routes, HTML/CSS/JS files, API files, and removed references from health routes. Leaderboard replaced by Prometheus metrics.

### Exact Commands to Validate

```bash
npm run dev:build
npm run dev:test
npm run dev:start
curl http://localhost:${PORT}/leaderboard  # Should be 404
```

### Direct Path to Test Log
`reports/tests/test-{timestamp}.log`

### Commit Hash
`git rev-parse HEAD`

---

**Document Status:** Ready for Implementation  
**Follows:** AI Coding Rules from `tests/test-data/AI_CODING_RULES.md`

