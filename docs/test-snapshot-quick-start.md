# Test Snapshot Implementation - Quick Start

## ✅ What Was Implemented

### 1. Seed Script

**File:** `scripts/seed-test-snapshot.sh`

Creates a Qdrant snapshot with pre-trained test adapters.

```bash
# Run it:
npm run test:seed-snapshot

# What it does:
# 1. Starts Qdrant binary (port 7633)
# 2. Starts KAIROS app with kairos_ci_mock collection
# 3. Trains AI_CODING_RULES adapter
# 4. Stops app
# 5. Creates snapshot → tests/test-data/kairos_ci.snapshot
```

### 2. Restore Utility

**File:** `tests/utils/restore-qdrant-snapshot.ts`

TypeScript utility to restore snapshot in test beforeAll hooks.

```typescript
import { restoreTestSnapshot } from '../utils/restore-qdrant-snapshot.js';

beforeAll(async () => {
  const result = await restoreTestSnapshot();
  if (!result.success) {
    throw new Error(result.message);
  }
}, 30000);
```

### 3. NPM Scripts

**File:** `package.json`

```json
{
  "scripts": {
    "test:seed-snapshot": "bash ./scripts/seed-test-snapshot.sh",
    "test:restore-snapshot": "node -r dotenv/config -e \"...\""
  }
}
```

### 4. Documentation

**File:** `docs/test-snapshot-seeding.md`

Complete guide with:

- How it works
- When to regenerate
- Adding new adapters
- Troubleshooting
- CI integration examples

---

## 🚀 Next Steps

### Step 1: Generate Snapshot (Local Dev)

```bash
# Make sure Qdrant is NOT running
npm run qdrant:binary:stop

# Generate snapshot
npm run test:seed-snapshot

# This will take 10-30 seconds (OpenAI API call)
```

### Step 2: Verify Snapshot

```bash
# Check file exists
ls -lh tests/test-data/kairos_ci.snapshot

# Should be ~100KB-1MB
```

### Step 3: Update Test Files

Replace train calls with snapshot restore:

**BEFORE:**

```typescript
test('train stores AI CODING RULES markdown', async () => {
  await purgeExistingProtocols();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const trainResult = await mcpConnection.client.callTool({
    name: 'train',
    arguments: { content: markdownDoc, llm_model_id: 'test-ai-coding-rules' }
  });
  
  expect(trainPayload.status).toBe('stored');
}, 60000);
```

**AFTER:**

```typescript
beforeAll(async () => {
  await restoreTestSnapshot();
}, 30000);

test('activate finds AI CODING RULES', async () => {
  // No train call needed!
  
  const activateResult = await mcpConnection.client.callTool({
    name: 'activate',
    arguments: { query: 'AI CODING RULES' }
  });
  
  expect(activatePayload.choices.length).toBeGreaterThan(0);
}, 30000);
```

### Step 4: Commit Snapshot

```bash
git add tests/test-data/kairos_ci.snapshot
git add scripts/seed-test-snapshot.sh
git add tests/utils/restore-qdrant-snapshot.ts
git add docs/test-snapshot-seeding.md
git add package.json

git commit -m "feat: add Qdrant snapshot seeding for faster integration tests

- Add seed script to generate test snapshot
- Add restore utility for beforeAll hooks
- Document snapshot workflow
- Eliminates OpenAI API calls during tests
- Reduces test time from 60s to 5s"
```

---

## 📊 Expected Results

### Test Performance

| Test | Before | After | Speedup |
|------|--------|-------|---------|
| kairos-train-access | 60s (timeout risk) | 5s | **12x** |
| kairos-search-access | 15s | 5s | **3x** |
| kairos-qdrant-storage | 20s | 5s | **4x** |

### CI Reliability

- ✅ **No more timeouts** (5s vs 60s limit)
- ✅ **Deterministic** (no OpenAI variability)
- ✅ **Faster feedback** (tests complete quicker)

---

## 🎯 Which Tests to Update First

Based on grep results, these tests use `purgeExistingProtocols()` + `train()`:

1. ✅ `kairos-train-access.test.ts` - **HIGH PRIORITY** (currently timing out)
2. ✅ `kairos-search-access.test.ts` - Tests search, uses train as setup
3. ✅ `kairos-qdrant-storage.test.ts` - Tests storage, uses train as setup

**Note:** The train tool test itself (`kairos-train-access.test.ts`) should **STILL test train** - but we can:

- Keep ONE test that validates train works
- Use snapshot for all OTHER tests

---

## 🔧 Troubleshooting

### Script fails to start Qdrant

```bash
# Check if port 7633 is in use
lsof -i :7633

# Kill existing process
kill <PID>

# Or use different port
QDRANT_HTTP_PORT=7644 npm run test:seed-snapshot
```

### Script fails to train adapter

```bash
# Check OpenAI API key
echo $OPENAI_API_KEY

# Check .env has correct key
grep OPENAI_API_KEY .env

# Test OpenAI connectivity
curl -sS https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "model": "text-embedding-3-small"}'
```

### Snapshot too large (>5MB)

```bash
# Check snapshot size
ls -lh tests/test-data/kairos_ci.snapshot

# If too large, something is wrong
# Snapshot should be ~100KB-1MB for test data
```

---

## 📝 Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `scripts/seed-test-snapshot.sh` | ✅ Created | Seed script |
| `tests/utils/restore-qdrant-snapshot.ts` | ✅ Created | Restore utility |
| `docs/test-snapshot-seeding.md` | ✅ Created | Documentation |
| `package.json` | ✅ Modified | Added npm scripts |
| `tests/test-data/kairos_ci.snapshot` | ⏳ Pending | Generated by seed script |

---

## 💡 Pro Tips

1. **Regenerate snapshot when test fixtures change**

   ```bash
   # Updated AI_CODING_RULES.md?
   npm run test:seed-snapshot
   git add tests/test-data/kairos_ci.snapshot
   ```

2. **Test restore locally before committing**

   ```bash
   npm run test:restore-snapshot
   ```

3. **Add snapshot validation to CI**

   ```yaml
   - name: Validate snapshot
     run: npm run test:restore-snapshot
   ```

4. **Monitor snapshot size**
   - Keep under 5MB
   - If growing, check for unnecessary adapters

---

## 🎓 Learning Resources

- **Qdrant Snapshots API:** <https://qdrant.tech/documentation/concepts/snapshots/>
- **GitHub Actions Cache:** <https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows>
- **KAIROS Test Architecture:** See `docs/test-snapshot-seeding.md`
