# Phase 5: Refactor Game Service to Stats Service

> **Implementation Guide** — Follow AI Coding Rules strictly  
> **Status:** Ready for Implementation  
> **Dependencies:** Phase 1, 2, 3, 4 must be complete

---

## Overview

This document provides step-by-step instructions for refactoring the "game" service to "stats" service, removing all "game" and "gem" terminology, and updating quality labels.

**What Phase 5 Delivers:**
- ✅ `src/services/game/` → `src/services/stats/`
- ✅ All "game" terminology removed
- ✅ All "gem" terminology removed
- ✅ Quality labels updated (legendary→excellent, rare→high, etc.)
- ✅ All imports updated
- ✅ Redis keys updated (if using Redis)
- ✅ Comments and documentation updated

**What Phase 5 Does NOT Include:**
- ❌ Testing & validation (Phase 6)

---

## AI Coding Rules Compliance

**This implementation MUST follow the AI Coding Rules exactly:**

1. ✅ **CHECK LOCAL DOCUMENTATION** - Use only documented npm scripts from README.md
2. ✅ **ESTABLISH BASELINE** - Run tests, archive baseline, ensure 100% green
3. ✅ **CREATE ISOLATED BRANCH** - `feat/refactor-game-to-stats-phase5`
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
git checkout -b feat/refactor-game-to-stats-phase5
```

---

## 3' Bullet Plan

### Scope
- Rename directory: `game/` → `stats/`
- Rename classes: `KnowledgeGameService` → `ModelStatsService`
- Rename instances: `knowledgeGame` → `modelStats`
- Rename types: `GameStats` → `ModelStats`, `GemScore` → `QualityScore`
- Update quality labels: legendary→excellent, rare→high, quality→standard, common→basic
- Update all imports (88+ files)
- Update Redis keys (if using Redis)
- Update comments and documentation
- Remove "gem" terminology from field names
- Delete motivation.ts and achievements.ts

### Files to Rename/Move
- `src/services/game/` → `src/services/stats/`
- All files in directory keep same names (except deletions)

### Files to Delete
- `src/services/stats/motivation.ts` (or simplify drastically)
- `src/services/stats/achievements.ts`

### Files to Modify (88+ references)
- All files importing from `../game/` or `../services/game/`
- All files using `knowledgeGame` instance
- All files with "game" or "gem" in comments
- All files with quality label enums

### Success Criteria
- ✅ `npm run dev:build` succeeds
- ✅ `npm run dev:test` passes (all tests green)
- ✅ No references to "game" or "gem" in codebase (except archived docs)
- ✅ Quality labels use new terminology
- ✅ All imports work
- ✅ Redis keys updated (if using Redis)
- ✅ All linting passes

**Wait for acknowledgment if scope is unclear.**

---

## Implementation Steps

### Step 1: Rename Directory

```bash
git mv src/services/game src/services/stats
```

### Step 2: Update Core Service File

**File:** `src/services/stats/knowledge-game.ts` → `src/services/stats/model-stats.ts`

**Rename class:**
```typescript
// BEFORE:
export class KnowledgeGameService {
  // ...
}
export const knowledgeGame = new KnowledgeGameService();

// AFTER:
export class ModelStatsService {
  // ...
}
export const modelStats = new ModelStatsService();
```

**Update file header comments:**
```typescript
/**
 * ModelStatsService (orchestrator)
 *
 * Manages model performance statistics and quality scoring.
 * Delegates to modular submodules:
 * - stats-types.ts
 * - stats-scoring.ts
 * - stats-bonuses.ts
 * - stats-healer.ts
 * - stats-protocol.ts
 */
```

### Step 3: Update Types

**File:** `src/services/stats/types.ts`

```typescript
// BEFORE:
export interface GemScore {
  // ...
  quality: 'legendary' | 'rare' | 'quality' | 'common' | 'not_gem';
}

export interface GameStats {
  totalGems: number;
  legendaryGems: number;
  // ...
}

export interface GameLeaderboard {
  // ...
}

// AFTER:
export interface QualityScore {
  specificity: number;
  expertValue: number;
  broadUtility: number;
  longevity: number;
  total: number;
  quality: 'excellent' | 'high' | 'standard' | 'basic' | 'below_threshold';
}

export interface ModelStats {
  totalContributions: number;
  excellentContributions: number;
  highContributions: number;
  standardContributions: number;
  basicContributions: number;
  lastUpdated: Date;
}

// GameLeaderboard removed - replaced by Prometheus metrics
```

### Step 4: Update Scoring

**File:** `src/services/stats/scoring.ts`

**Rename functions:**
```typescript
// BEFORE:
export function calculateGemScore(...): GemScore { }
export function calculateStepGemMetadata(...) { }

// AFTER:
export function calculateQualityScore(...): QualityScore { }
export function calculateStepQualityMetadata(...) { }
```

**Update quality mapping:**
```typescript
// Map old quality to new quality
const qualityMap = {
  'legendary': 'excellent',
  'rare': 'high',
  'quality': 'standard',
  'common': 'basic',
  'not_gem': 'below_threshold'
};
```

### Step 5: Update All Imports

**Use find and replace (carefully):**

```bash
# Find all imports
grep -r "from.*game" src/ --exclude-dir=node_modules

# Replace:
# '../game/knowledge-game.js' → '../stats/model-stats.js'
# '../services/game/knowledge-game.js' → '../services/stats/model-stats.js'
# 'knowledgeGame' → 'modelStats'
```

**Files to update:**
- `src/tools/kairos_attest.ts`
- `src/services/qdrant/memory-updates.ts`
- `src/services/memory/store-chain.ts`
- `src/services/memory/store-chain-header.ts`
- `src/services/memory/store-chain-default.ts`
- `src/resources/memory-resource.ts`
- `src/services/stats/index.ts`

### Step 6: Update Function Calls

**Replace all function calls:**

```typescript
// BEFORE:
knowledgeGame.calculateGemScore(...)
knowledgeGame.calculateStepGemMetadata(...)
knowledgeGame.processGemDiscovery(...)
knowledgeGame.getLeaderboard()

// AFTER:
modelStats.calculateQualityScore(...)
modelStats.calculateStepQualityMetadata(...)
modelStats.processContribution(...)
// getLeaderboard() removed - use Prometheus metrics
```

### Step 7: Update Field Names

**File:** `src/services/qdrant/quality.ts`

```typescript
// BEFORE:
gem_metadata: {
  step_gem_potential: number;
  step_quality: 'quality' | 'rare' | 'legendary';
  motivational_text: string;
}

// AFTER:
quality_metadata: {
  step_quality_score: number;
  step_quality: 'excellent' | 'high' | 'standard' | 'basic';
  // motivational_text removed (hype)
}
```

**Update all references to:**
- `gem_metadata` → `quality_metadata`
- `step_gem_potential` → `step_quality_score`
- `calculateStepGemMetadata` → `calculateStepQualityMetadata`
- `updateGemMetadata` → `updateQualityMetadata`

### Step 8: Update Redis Keys (if using Redis)

**File:** `src/services/stats/model-stats.ts`

```typescript
// BEFORE:
await redisService.hgetall('game:implementationBonusTotals');
await redisService.hsetall('game:implementationBonusTotals', data);
await redisService.hgetall('game:rareSuccessCounts');
await redisService.hsetall('game:rareSuccessCounts', data);

// AFTER:
await redisService.hgetall('stats:implementationBonusTotals');
await redisService.hsetall('stats:implementationBonusTotals', data);
await redisService.hgetall('stats:rareSuccessCounts');
await redisService.hsetall('stats:rareSuccessCounts', data);
```

**Note:** If not using Redis for these, can remove entirely.

### Step 9: Update Comments

**Search and replace in all files:**
- "Knowledge Mining Game" → "Model Statistics"
- "game" → "stats" (in comments)
- "gem" → "contribution" or "knowledge" (in comments)
- "leaderboard" → "metrics" (in comments)

### Step 10: Delete Unused Files

```bash
rm src/services/stats/motivation.ts
rm src/services/stats/achievements.ts
```

**Update:** `src/services/stats/index.ts`

```typescript
// Remove exports for deleted files
// export * from './motivation.js'; // DELETED
// export * from './achievements.js'; // DELETED
```

### Step 11: Update Test Files

**File:** `tests/unit/markdown-structure-json-string.test.ts`

```typescript
// Update path reference if it exists
// Change: docs/knowledge-mining-game.md → docs/archived/knowledge-mining-game.md
```

---

## Testing

### Step 1: Build

```bash
npm run dev:build
```

**Verify:** Build succeeds, no import errors.

### Step 2: Run Tests

```bash
npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
```

**CRITICAL: All tests MUST pass with zero failures.**

### Step 3: Verify No Game/Gem References

```bash
# Should return minimal results (only in archived docs)
grep -r "game\|Game\|GAME" src/ --exclude-dir=node_modules | grep -v "archived"
grep -r "gem\|Gem\|GEM" src/ --exclude-dir=node_modules | grep -v "archived"
```

### Step 4: Linting

```bash
npm run lint
```

---

## Hygiene Checklist

- [ ] Run linter: `npm run lint` (all errors fixed)
- [ ] Remove all debug prints
- [ ] Verify no broken imports
- [ ] Check no orphaned files
- [ ] Verify TypeScript compilation
- [ ] Check Redis key migration (if using Redis)

---

## Commit

### Commit Message

```
refactor(stats): rename game service to stats service phase 5

- Rename game/ directory to stats/
- Rename KnowledgeGameService to ModelStatsService
- Rename knowledgeGame to modelStats
- Update quality labels: legendary→excellent, rare→high, quality→standard, common→basic
- Remove "gem" terminology (GemScore→QualityScore, etc.)
- Update all imports (88+ files)
- Update Redis keys: game:* → stats:*
- Delete motivation.ts and achievements.ts
- Update comments and documentation

Phase 5 removes all game/gem terminology. Service now focuses on stats.
```

---

## Final Verification

- [x] Baseline archived and was 100% green
- [x] All tests pass
- [x] No "game" or "gem" references in code (except archived)
- [x] Quality labels use new terminology
- [x] All imports work
- [x] Linting passes

---

## Handoff

### One-Sentence Summary
Refactored game service to stats service: renamed directory, classes, types, updated quality labels, removed gem terminology, updated 88+ imports, and deleted unused files.

### Exact Commands to Validate

```bash
npm run dev:build
npm run dev:test
grep -r "game\|gem" src/ --exclude-dir=node_modules | grep -v archived
```

### Direct Path to Test Log
`reports/tests/test-{timestamp}.log`

### Commit Hash
`git rev-parse HEAD`

---

**Document Status:** Ready for Implementation  
**Follows:** AI Coding Rules from `tests/test-data/AI_CODING_RULES.md`

