# Qdrant Snapshot Test Seeding

## Overview

Integration tests use Qdrant snapshots to pre-seed test data, eliminating expensive `train()` calls during test execution. This makes tests:

- ✅ **Fast** (restore snapshot in seconds vs. 10-60s for train)
- ✅ **Deterministic** (no OpenAI API variability)
- ✅ **Reliable** (no network timeouts in CI)

## How It Works

### Seed Phase (Development)

```bash
# 1. Run seed script (creates snapshot)
npm run test:seed-snapshot

# What it does:
# - Starts Qdrant binary (port 7633)
# - Starts KAIROS app with kairos_ci_mock collection
# - Trains AI_CODING_RULES adapter (and other test adapters)
# - Stops app
# - Creates Qdrant snapshot
# - Saves to tests/test-data/kairos_ci.snapshot
```

### Restore Phase (CI / Tests)

```typescript
// In test files:
import { restoreTestSnapshot } from '../utils/restore-qdrant-snapshot.js';

beforeAll(async () => {
  const result = await restoreTestSnapshot();
  if (!result.success) {
    throw new Error(result.message);
  }
}, 30000);
```

## When to Regenerate Snapshot

Regenerate the snapshot when:

1. **Adding new test adapters** - Tests need adapters that aren't in the snapshot
2. **Updating AI_CODING_RULES.md** - Test fixture changed
3. **Changing adapter structure** - Train tool schema changed
4. **Snapshot is stale** - Tests fail due to missing data

## File Locations

| File | Purpose |
|------|---------|
| `scripts/seed-test-snapshot.sh` | Seed script - creates snapshot |
| `tests/utils/restore-qdrant-snapshot.ts` | Restore utility - used by tests |
| `tests/test-data/kairos_ci.snapshot` | Snapshot file (commit to git) |
| `tests/test-data/AI_CODING_RULES.md` | Test adapter content |

## CI Integration

### Current State (BEFORE snapshot)

```yaml
- name: Start Qdrant
  run: npm run qdrant:binary:start

- name: Run tests
  run: npm run dev_simple:test
  # Tests call train() → OpenAI API → 10-60s per test
  # Can timeout in CI (60s limit)
```

### Future State (AFTER snapshot)

```yaml
- name: Start Qdrant
  run: npm run qdrant:binary:start

- name: Restore snapshot cache
  uses: actions/cache/restore@v5
  with:
    path: tests/test-data/kairos_ci.snapshot
    key: qdrant-snapshot-${{ hashFiles('tests/test-data/AI_CODING_RULES.md') }}

- name: Run tests
  run: npm run dev_simple:test
  # Tests restore snapshot → 1-2s
  # No OpenAI API calls → deterministic, fast
```

## Adding New Test Adapters

To add a new adapter to the snapshot:

### 1. Edit seed script

```bash
# Edit: scripts/seed-test-snapshot.sh

# Add after line ~150 (where AI_CODING_RULES is trained):

log_info "Training MY_NEW_ADAPTER..."
MY_ADAPTER_CONTENT=$(cat "${ROOT_DIR}/tests/test-data/MY_NEW_ADAPTER.md" | python3 -c 'import sys, json; print(json.dumps(sys.stdin.read()))')

TRAIN_RESPONSE=$(call_mcp_tool "train" "{
  \"content\": ${MY_ADAPTER_CONTENT},
  \"llm_model_id\": \"test-my-adapter\",
  \"force_update\": true
}")

if echo "${TRAIN_RESPONSE}" | grep -q '"status".*"stored"'; then
  log_success "MY_NEW_ADAPTER trained"
else
  log_error "Failed to train MY_NEW_ADAPTER"
  exit 1
fi
```

### 2. Regenerate snapshot

```bash
npm run test:seed-snapshot
```

### 3. Commit snapshot

```bash
git add tests/test-data/kairos_ci.snapshot
git commit -m "chore: regenerate test snapshot with MY_NEW_ADAPTER"
```

### 4. Update tests to use snapshot

```typescript
// BEFORE (slow, calls train):
test('my new test', async () => {
  await purgeExistingProtocols();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const trainResult = await mcpConnection.client.callTool({
    name: 'train',
    arguments: { content: myAdapter, llm_model_id: 'test-my-adapter' }
  });
  
  // assertions...
}, 60000);

// AFTER (fast, restores snapshot):
beforeAll(async () => {
  await restoreTestSnapshot();
}, 30000);

test('my new test', async () => {
  // No train call needed - adapter already in snapshot
  
  // Test activate, search, or other tools
  const activateResult = await mcpConnection.client.callTool({
    name: 'activate',
    arguments: { query: 'MY NEW ADAPTER' }
  });
  
  // assertions...
}, 30000);
```

## Troubleshooting

### Snapshot file not found

```
Error: Snapshot file not found: tests/test-data/kairos_ci.snapshot
```

**Solution:** Run `npm run test:seed-snapshot`

### Qdrant not ready

```
Error: Qdrant not ready at http://localhost:7633
```

**Solution:** 
- Check if Qdrant is running: `npm run qdrant:binary:status`
- Start Qdrant: `npm run qdrant:binary:start`
- Check logs: `tail -f .local/qdrant-binary/qdrant.log`

### Restore failed

```
Error: Restore failed: Snapshot upload failed: HTTP 400
```

**Possible causes:**
1. Collection name mismatch - check `QDRANT_COLLECTION` env var
2. Qdrant version incompatibility - regenerate snapshot
3. Corrupted snapshot file - delete and regenerate

**Solution:**
```bash
# Delete corrupted snapshot
rm tests/test-data/kairos_ci.snapshot

# Regenerate
npm run test:seed-snapshot
```

### Tests still slow after restore

**Check:**
1. Snapshot is being restored in `beforeAll` (not `beforeEach`)
2. Tests are not calling `train()` anymore
3. Qdrant is running on correct port

**Debug:**
```bash
# Enable verbose logging
export DEBUG=snapshot-restore:*
npm run dev_simple:test
```

## Performance Comparison

| Operation | Time (local) | Time (CI) |
|-----------|--------------|-----------|
| **Train adapter** | 5-10s | 10-60s (variable) |
| **Restore snapshot** | 1-2s | 2-5s (deterministic) |
| **Speedup** | **3-5x** | **5-12x** |

## Collection Names

| Environment | Collection Name | Purpose |
|-------------|----------------|---------|
| Local dev (seed) | `kairos_ci_mock` | Generate snapshot |
| CI (simple) | `kairos_simple_ci` | Simple mode tests |
| CI (auth) | `kairos_dev` | Auth mode tests |

**Note:** Snapshot is generated with `kairos_ci_mock` but can be restored to any collection name by setting `QDRANT_COLLECTION` env var.

## Future Improvements

- [ ] Add CI cache for snapshot file
- [ ] Automated snapshot regeneration when test fixtures change
- [ ] Snapshot validation in CI (verify snapshot integrity before tests)
- [ ] Multiple snapshots for different test scenarios
- [ ] Auth mode snapshot (includes Keycloak test users)
