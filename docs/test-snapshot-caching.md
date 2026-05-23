# Qdrant Snapshot Caching - Simplified Architecture

## Overview

All tests use a single `kairos_ci` collection with snapshot caching for fast, deterministic test execution.

## Architecture

### Single Collection Strategy

```
┌─────────────────────────────────────────┐
│         Test Execution Flow             │
├─────────────────────────────────────────┤
│ 1. Start Qdrant (empty)                 │
│ 2. Restore snapshot → kairos_ci         │
│ 3. Run read-only tests (activate/search)│
│ 4. Run read-write tests (train/delete)  │
│ 5. Cleanup                              │
└─────────────────────────────────────────┘
```

**Benefits:**
- ✅ Predictable state (always starts from same snapshot)
- ✅ Simple collection naming (no `_mock`, `_simple`, `_dev` suffixes)
- ✅ Easy to debug (one collection to inspect)
- ✅ Consistent across local dev and CI

### Cache Locations

| Environment | Cache Path | Managed By |
|-------------|------------|------------|
| **Local Dev** | `.local/qdrant-snapshot/kairos_ci.snapshot` | Developer runs `npm run test:seed-snapshot` |
| **CI (GitHub Actions)** | `.local/qdrant-snapshot/kairos_ci.snapshot` | GitHub Actions cache |

**Both use the SAME path** - workflow is identical!

### Cache Invalidation

Snapshot cache is invalidated when:
1. `scripts/seed-test-snapshot.sh` changes (seed logic updated)
2. `tests/test-data/AI_CODING_RULES.md` changes (test fixture updated)

**Cache key:**
```
${{ runner.os }}-qdrant-snapshot-${{ hashFiles('scripts/seed-test-snapshot.sh', 'tests/test-data/AI_CODING_RULES.md') }}
```

## Workflow

### Local Development

```bash
# 1. Generate snapshot (first time or when fixtures change)
npm run test:seed-snapshot

# What happens:
# - Starts Qdrant binary (port 7633)
# - Starts KAIROS with kairos_ci collection
# - Trains test adapters
# - Creates snapshot → .local/qdrant-snapshot/kairos_ci.snapshot

# 2. Run tests (snapshot auto-restored)
npm run dev_simple:test

# What happens:
# - Tests call restoreTestSnapshot()
# - Checks .local/qdrant-snapshot/kairos_ci.snapshot
# - Restores to kairos_ci collection (1-2 seconds)
# - Tests run against pre-seeded data
```

### CI (GitHub Actions)

```yaml
# 1. Restore snapshot cache
- name: Restore Qdrant test snapshot cache
  uses: actions/cache/restore@v5
  with:
    path: .local/qdrant-snapshot/kairos_ci.snapshot
    key: ${{ runner.os }}-qdrant-snapshot-${{ hashFiles(...) }}

# 2. Generate snapshot if cache miss
- name: Generate Qdrant snapshot (cache miss)
  if: steps.qdrant-snapshot-cache.outputs.cache-hit != 'true'
  run: npm run test:seed-snapshot

# 3. Save snapshot cache
- name: Save Qdrant test snapshot cache
  uses: actions/cache/save@v5
  if: steps.qdrant-snapshot-cache.outputs.cache-hit != 'true'
  with:
    path: .local/qdrant-snapshot/kairos_ci.snapshot
    key: ${{ runner.os }}-qdrant-snapshot-${{ hashFiles(...) }}

# 4. Run tests (snapshot auto-restored)
- name: Run tests
  run: npm run dev_simple:test
```

## Environment Variables

### Collection Name

**All environments use:** `QDRANT_COLLECTION=kairos_ci`

**Set in:**
- `.env.dev_simple` → `QDRANT_COLLECTION=kairos_ci`
- `.env` (fullstack) → `QDRANT_COLLECTION=kairos_ci`
- `scripts/env/.env.template` → `QDRANT_COLLECTION=kairos_ci`
- CI workflow → inherits from .env files

### CI Detection

**Question:** How do tests know if they're running in CI vs local?

**Answer:** Use standard `CI=true` environment variable

```typescript
// Example usage in test utilities
const isCI = process.env.CI === 'true';

if (isCI) {
  // CI-specific behavior (if needed)
  console.log('Running in CI environment');
} else {
  // Local dev behavior
  console.log('Running in local environment');
}
```

**Set automatically by:**
- GitHub Actions (always sets `CI=true`)
- Jest/Vitest test runners
- Can be manually set: `CI=true npm run test`

**Benefits:**
- ✅ Standard convention (all CI systems use this)
- ✅ No custom env vars to manage
- ✅ Works everywhere (GitHub Actions, GitLab CI, local dev)

## File Structure

```
.local/
  qdrant-snapshot/
    kairos_ci.snapshot          # Generated snapshot (cached, not committed)

scripts/
  seed-test-snapshot.sh         # Seed script (committed)

tests/
  test-data/
    AI_CODING_RULES.md          # Test fixture (committed, tracked for cache key)
  utils/
    restore-qdrant-snapshot.ts  # Restore utility (committed)
```

**Git tracked:**
- ✅ `scripts/seed-test-snapshot.sh`
- ✅ `tests/test-data/AI_CODING_RULES.md`
- ✅ `tests/utils/restore-qdrant-snapshot.ts`

**Git ignored:**
- ❌ `.local/qdrant-snapshot/kairos_ci.snapshot` (cached locally and in CI)

## Test Execution Order

### Phase 1: Read-Only Tests
Tests that don't modify data:

```typescript
describe('Read-only tests', () => {
  beforeAll(async () => {
    await restoreTestSnapshot(); // Restore once
  }, 30000);

  test('activate finds AI CODING RULES', async () => {
    // No train call needed!
    const result = await activate('AI CODING RULES');
    expect(result.choices.length).toBeGreaterThan(0);
  });

  test('search returns results', async () => {
    const result = await search('coding rules');
    expect(result.matches.length).toBeGreaterThan(0);
  });
});
```

### Phase 2: Read-Write Tests
Tests that modify data (train, delete, tune):

```typescript
describe('Read-write tests', () => {
  beforeAll(async () => {
    await restoreTestSnapshot(); // Start from known state
  }, 30000);

  test('train stores new adapter', async () => {
    // This modifies kairos_ci collection
    const result = await train(newAdapter);
    expect(result.status).toBe('stored');
  });

  test('delete removes adapter', async () => {
    // This modifies kairos_ci collection
    const result = await deleteAdapter(uri);
    expect(result.deleted).toBe(1);
  });
});
```

**Important:** Each test file should restore snapshot in `beforeAll` to ensure clean state.

## Regenerating Snapshots

### When to Regenerate

1. **Updated test fixtures:**
   ```bash
   # Modified AI_CODING_RULES.md?
   npm run test:seed-snapshot
   ```

2. **Added new test adapters:**
   ```bash
   # Edit scripts/seed-test-snapshot.sh to add new adapters
   npm run test:seed-snapshot
   ```

3. **Changed seed logic:**
   ```bash
   # Modified seed-test-snapshot.sh?
   npm run test:seed-snapshot
   ```

4. **CI cache invalidated:**
   - Automatic when files in cache key change
   - CI will regenerate on next run

### How to Regenerate

```bash
# Stop any running KAIROS/Qdrant
npm run dev:stop
npm run qdrant:binary:stop

# Generate fresh snapshot
npm run test:seed-snapshot

# Verify
ls -lh .local/qdrant-snapshot/kairos_ci.snapshot

# Run tests
npm run dev_simple:test
```

## Troubleshooting

### Snapshot not found

```
Error: Snapshot file not found. Run: npm run test:seed-snapshot
```

**Solution:**
```bash
npm run test:seed-snapshot
```

### Cache miss in CI

CI logs show:
```
Snapshot cache miss - generating new snapshot...
```

**This is normal on:**
- First run after cache key change
- Cache expiration (GitHub Actions 7-day limit)
- New runner OS version

**No action needed** - CI will generate and cache automatically.

### Local cache stale

**Symptoms:** Tests fail with missing adapters

**Solution:**
```bash
# Delete old cache
rm -rf .local/qdrant-snapshot/

# Regenerate
npm run test:seed-snapshot
```

### Port conflicts

```
Error: Qdrant failed to start (port 7633 in use)
```

**Solution:**
```bash
# Kill existing Qdrant
npm run qdrant:binary:stop

# Or find and kill manually
lsof -i :7633
kill <PID>
```

## Performance Comparison

| Scenario | Before (train) | After (snapshot) | Speedup |
|----------|----------------|------------------|---------|
| **Local dev (first run)** | 10-30s | 10-30s (seed) | Same |
| **Local dev (subsequent)** | 10-30s | 1-2s | **10x** |
| **CI (cache hit)** | 10-60s | 1-2s | **15x** |
| **CI (cache miss)** | 10-60s | 10-30s (seed) | Same |

## Migration Guide

### From Old Approach

**Before (multiple collections):**
```bash
# .env.dev_simple
QDRANT_COLLECTION=kairos_simple_ci

# .env (fullstack)
QDRANT_COLLECTION=kairos_dev
```

**After (unified):**
```bash
# All environments
QDRANT_COLLECTION=kairos_ci
```

### Updating Test Files

**Before:**
```typescript
// Different tests used different collections
await purgeExistingProtocols();
await train(adapter); // Slow, variable
```

**After:**
```typescript
// All tests use same collection with snapshot
beforeAll(async () => {
  await restoreTestSnapshot(); // Fast, deterministic
}, 30000);

// No train call needed for read-only tests
```

## Best Practices

1. **Always restore snapshot in beforeAll**
   ```typescript
   beforeAll(async () => {
     await restoreTestSnapshot();
   }, 30000);
   ```

2. **Don't commit snapshots**
   - `.local/` is in `.gitignore`
   - CI manages its own cache

3. **Regenerate when fixtures change**
   - Update `AI_CODING_RULES.md`? → Regenerate
   - Add new test adapter? → Regenerate

4. **Use CI=true for environment detection**
   ```typescript
   const isCI = process.env.CI === 'true';
   ```

5. **Keep snapshot small (<5MB)**
   - Only include necessary adapters
   - Monitor size: `ls -lh .local/qdrant-snapshot/kairos_ci.snapshot`
