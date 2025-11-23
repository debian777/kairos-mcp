# Phase 1: Prometheus Metrics Infrastructure Implementation

> **Implementation Guide** — Follow AI Coding Rules strictly  
> **Status:** Ready for Implementation  
> **Dependencies:** None (works with single-tenant, future-proof for multi-tenant)

---

## Overview

This document provides step-by-step instructions for implementing Phase 1 of the Prometheus metrics infrastructure. This phase establishes the foundation: metrics registry, separate metrics server, and basic infrastructure.

**What Phase 1 Delivers:**
- ✅ Prometheus metrics registry with default labels
- ✅ Separate metrics server on dedicated port (9090)
- ✅ Tenant context utility (defaults to "default" for now)
- ✅ Basic metric definitions (not yet instrumented)
- ✅ Configuration updates

**What Phase 1 Does NOT Include:**
- ❌ Actual instrumentation of tools/operations (Phase 2)
- ❌ Multi-tenant authentication (can be added later)
- ❌ Leaderboard removal (Phase 4)

---

## AI Coding Rules Compliance

**This implementation MUST follow the AI Coding Rules exactly:**

1. ✅ **CHECK LOCAL DOCUMENTATION** - Use only documented npm scripts from README.md
2. ✅ **ESTABLISH BASELINE** - Run tests, archive baseline, ensure 100% green
3. ✅ **CREATE ISOLATED BRANCH** - `feat/prometheus-metrics-phase1`
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

**Follow CHECK LOCAL DOCUMENTATION: Check README.md for test commands.**

```bash
# Read README.md to find test command
# Use ONLY documented npm scripts

# Run baseline tests
npm run dev:test

# Archive baseline output
mkdir -p reports/tests
npm run dev:test > reports/tests/baseline-$(date +%Y%m%d-%H%M%S).log 2>&1

# Record commit hash and branch
git rev-parse HEAD > reports/tests/baseline-commit.txt
git branch --show-current > reports/tests/baseline-branch.txt
```

**CRITICAL: Only proceed if ALL tests pass with zero failures.**

If baseline has any failures ← STOP and escalate to human. Do not proceed.

### 2. Create Isolated Branch

```bash
git checkout -b feat/prometheus-metrics-phase1
```

**Branch naming:** `feat/prometheus-metrics-phase1` (type: feat, descriptive slug)

---

## 3' Bullet Plan

### Scope
- Install prom-client dependency
- Create metrics service infrastructure (registry, basic structure)
- Create separate metrics server on port 9090
- Add tenant context utility (defaults to "default")
- Update configuration for METRICS_PORT
- Add basic metric type definitions (not yet used)

### Files to Create
- `src/services/metrics/registry.ts` - Prometheus registry setup
- `src/services/metrics/index.ts` - Main metrics service
- `src/utils/tenant-context.ts` - Tenant ID extraction
- `src/metrics-server.ts` - Separate Express server for metrics
- `src/services/metrics/types.ts` - TypeScript types for metrics

### Files to Modify
- `src/config.ts` - Add METRICS_PORT configuration
- `src/index.ts` - Start metrics server
- `package.json` - Add prom-client dependency

### Success Criteria
- ✅ `npm run dev:build` succeeds
- ✅ `npm run dev:test` passes (all tests green)
- ✅ Metrics server starts on port 9090
- ✅ `curl http://localhost:9090/metrics` returns Prometheus format
- ✅ Default labels (`kairos_version`, `instance`) appear in metrics
- ✅ No `/metrics` route on main application port
- ✅ All linting passes

**Wait for acknowledgment if scope is unclear.**

---

## Implementation Steps

### Step 1: Install Dependencies

```bash
npm install prom-client
npm install --save-dev @types/prom-client
```

**Verify:**
```bash
npm list prom-client
```

### Step 2: Create Tenant Context Utility

**File:** `src/utils/tenant-context.ts`

```typescript
/**
 * Extract tenant_id from request context.
 * 
 * CURRENT: Returns 'default' for single-tenant deployments.
 * FUTURE: Will extract from OAuth tokens, API keys, or headers when multi-tenant is implemented.
 * 
 * See docs/multi-user.md for future multi-tenant architecture.
 */

/**
 * Get tenant ID from request context.
 * 
 * @param request - Express request or MCP request object
 * @returns Tenant ID (defaults to 'default' for single-tenant)
 */
export function getTenantId(request?: any): string {
  // TODO: When multi-tenant is implemented, add extraction logic:
  // - X-Tenant-ID header (for API key requests)
  // - OAuth token claims (for authenticated users)
  // - Request metadata (for MCP requests)
  
  // For now, always return default for single-tenant
  return process.env.DEFAULT_TENANT_ID || 'default';
}
```

**Test:** Create simple test to verify default behavior.

### Step 3: Create Metrics Registry

**File:** `src/services/metrics/registry.ts`

```typescript
import { Registry } from 'prom-client';
import { getBuildVersion } from '../../utils/build-version.js';
import os from 'os';

/**
 * Prometheus metrics registry for KAIROS.
 * 
 * All metrics are registered here and exposed via /metrics endpoint.
 * Default labels are automatically applied to all metrics.
 */
export const register = new Registry();

// Set mandatory default labels on all metrics
register.setDefaultLabels({
  service: 'kairos',
  kairos_version: getBuildVersion(),
  instance: process.env.INSTANCE_ID || os.hostname() || 'unknown'
});

// Note: tenant_id is NOT a default label - it must be set per-metric
// based on request context to ensure proper tenant isolation
```

**Verify:** Registry exports correctly.

### Step 4: Create Metrics Service Index

**File:** `src/services/metrics/index.ts`

```typescript
/**
 * Metrics service for KAIROS.
 * 
 * This module exports the Prometheus registry and provides
 * access to all metric collectors.
 * 
 * Metrics are organized by category:
 * - MCP tool metrics (mcp-metrics.ts)
 * - Memory operation metrics (memory-metrics.ts)
 * - Qdrant metrics (qdrant-metrics.ts)
 * - Agent performance metrics (agent-metrics.ts)
 * - Quality metrics (quality-metrics.ts)
 * - Embedding metrics (embedding-metrics.ts)
 * - HTTP metrics (http-metrics.ts)
 * - System metrics (system-metrics.ts)
 * - Redis metrics (redis-metrics.ts)
 */

export { register } from './registry.js';

// Metric modules will be imported here as they are created
// For Phase 1, we only export the registry
```

### Step 5: Create Metrics Types

**File:** `src/services/metrics/types.ts`

```typescript
/**
 * TypeScript types for Prometheus metrics.
 */

export interface MetricLabels {
  tenant_id: string;
  [key: string]: string | number | undefined;
}

export interface MCPToolLabels extends MetricLabels {
  tool: string;
  status: 'success' | 'error' | 'timeout';
}

export interface MemoryOperationLabels extends MetricLabels {
  quality?: 'excellent' | 'high' | 'standard' | 'basic';
  operation?: 'store' | 'retrieve' | 'search' | 'update' | 'delete';
}

export interface AgentLabels extends MetricLabels {
  agent_id: string;
  quality?: 'excellent' | 'high' | 'standard' | 'basic';
}
```

### Step 6: Update Configuration

**File:** `src/config.ts`

Add to existing config:

```typescript
import os from 'os';

// ... existing config ...

export const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9090', 10);
export const INSTANCE_ID = process.env.INSTANCE_ID || os.hostname() || 'unknown';
export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default';
```

### Step 7: Create Metrics Server

**File:** `src/metrics-server.ts`

```typescript
import express from 'express';
import { register } from './services/metrics/registry.js';
import { structuredLogger } from './utils/structured-logger.js';
import { METRICS_PORT } from './config.js';

/**
 * Start dedicated metrics server on separate port.
 * 
 * This server ONLY exposes /metrics endpoint for Prometheus scraping.
 * 
 * Production benefits:
 * - Complete isolation from application traffic
 * - Can be restricted to internal networks only
 * - No impact on application performance
 * - Standard Prometheus deployment pattern
 */
export function startMetricsServer(port: number = METRICS_PORT): void {
  const app = express();
  
  // ONLY route: /metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      structuredLogger.error('Error generating metrics', error);
      res.status(500).end('Error generating metrics');
    }
  });
  
  // Health check for metrics server (optional but recommended)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'metrics' });
  });
  
  app.listen(port, () => {
    structuredLogger.info(`Metrics server listening on port ${port}`);
    structuredLogger.info(`Metrics endpoint: http://localhost:${port}/metrics`);
  });
}
```

**Critical:** This is a completely separate Express server. Main application server should NOT have `/metrics` route.

### Step 8: Integrate Metrics Server

**File:** `src/index.ts`

Add after existing initialization:

```typescript
import { startMetricsServer } from './metrics-server.js';

async function main(): Promise<void> {
  try {
    // ... existing initialization (memory store, MCP server, etc.) ...
    
    // Start dedicated metrics server on separate port
    // This runs independently from the main application server
    startMetricsServer();
    
    structuredLogger.info(`Application server: ${PORT}`);
    structuredLogger.info(`Metrics server: ${METRICS_PORT} (isolated)`);
    
    // ... rest of initialization (start main HTTP server) ...
  } catch (err) {
    // ... existing error handling ...
  }
}
```

### Step 9: Verify Main Server Has No Metrics Route

**File:** `src/http-server.ts` and `src/http-api-routes.ts`

**Verify:** Ensure there is NO `/metrics` route in the main application server.

The main server should only have:
- `/health`
- `/mcp`
- `/api/kairos_mint/raw`
- `/` (info endpoint)

**DO NOT add `/metrics` to main server.**

---

## Testing

### Step 1: Build

**Follow CHECK LOCAL DOCUMENTATION: Check README.md for build commands.**

```bash
# Use documented build command
npm run dev:build
```

**Verify:** Build succeeds without errors.

### Step 2: Run Tests

**Follow CHECK LOCAL DOCUMENTATION: Check README.md for test commands.**

```bash
# Use documented test command
npm run dev:test

# Capture output
npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
```

**CRITICAL: All tests MUST pass with zero failures.**

If any test fails → return to implementation steps. Do not weaken assertions.

### Step 3: Manual Verification

```bash
# Start server
npm run dev:start

# In another terminal, test metrics endpoint
curl http://localhost:9090/metrics

# Should return Prometheus format with default labels
# Look for: kairos_version, instance labels

# Verify main server does NOT have /metrics
curl http://localhost:${PORT}/metrics
# Should return 404 or route not found

# Test metrics server health
curl http://localhost:9090/health
# Should return: {"status":"ok","service":"metrics"}
```

### Step 4: Linting

```bash
npm run lint
```

**Fix all linting errors before committing.**

---

## Hygiene Checklist

- [ ] Run linter: `npm run lint` (all errors fixed)
- [ ] Run formatter: `npm run lint:fix` (if available)
- [ ] Remove all debug prints/console.logs
- [ ] Scan for secrets (no API keys, passwords, tokens)
- [ ] Remove dead code
- [ ] Verify no test files were accidentally committed
- [ ] Check that all imports are used

---

## Commit

### Commit Message Format

```
feat(metrics): add Prometheus metrics infrastructure phase 1

- Install prom-client dependency
- Create metrics registry with default labels (kairos_version, instance)
- Add separate metrics server on port 9090
- Add tenant context utility (defaults to "default")
- Update configuration for METRICS_PORT and INSTANCE_ID
- Metrics server isolated from main application server

Phase 1 establishes foundation. Actual instrumentation in Phase 2.
```

### Proof of Work

**Before committing:**

1. Run tests and capture output:
   ```bash
   npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
   ```

2. Verify test log shows:
   ```
   Test Suites: X passed, X total
   Tests:       Y passed, Y total
   ```

3. Create commit:
   ```bash
   git add .
   git commit -m "feat(metrics): add Prometheus metrics infrastructure phase 1

   - Install prom-client dependency
   - Create metrics registry with default labels
   - Add separate metrics server on port 9090
   - Add tenant context utility
   - Update configuration

   Phase 1 establishes foundation."
   ```

4. Push to branch:
   ```bash
   git push origin feat/prometheus-metrics-phase1
   ```

**No commit is valid without a corresponding green test log.**

---

## Final Verification

**Proof of work is only accepted when:**

- [x] Baseline archived and was 100% green (zero failures)
- [x] Plan followed or deviations documented
- [x] All changes minimal and in scope
- [x] Full test suite green with test log in `reports/tests/test-{timestamp}.log` (zero failures)
- [x] Commit exists with clean message
- [x] No disabled or weakened tests
- [x] Linting passes
- [x] Metrics server starts on port 9090
- [x] `/metrics` endpoint returns Prometheus format
- [x] Main server does NOT have `/metrics` route
- [x] Default labels appear in metrics output

**FORBIDDEN:**
- ❌ Claiming "it was like that when I got here" about test failures
- ❌ Proceeding when baseline had failures
- ❌ Committing code that introduces test failures
- ❌ Adding `/metrics` route to main application server

If any item fails → return to the implementation step that failed.

---

## Handoff

### One-Sentence Summary
Added Prometheus metrics infrastructure: separate metrics server on port 9090, registry with default labels, tenant context utility (defaults to "default"), and configuration updates.

### Exact Commands to Validate

```bash
# Build
npm run dev:build

# Test
npm run dev:test

# Start server
npm run dev:start

# Verify metrics endpoint (in another terminal)
curl http://localhost:9090/metrics

# Verify main server has no metrics route
curl http://localhost:${PORT}/metrics  # Should be 404

# Verify metrics server health
curl http://localhost:9090/health
```

### Direct Path to Test Log
`reports/tests/test-{timestamp}.log`

### Commit Hash
`git rev-parse HEAD` (after commit)

### Remaining Risks
- None for Phase 1 (infrastructure only, no instrumentation yet)
- Phase 2 will add actual metric instrumentation
- Multi-tenant support can be added later without breaking metrics

---

## Next Steps

After Phase 1 is complete and verified:

1. **Phase 2:** Add actual metric instrumentation (MCP tools, memory operations, etc.)
2. **Phase 3:** Instrument remaining services (Qdrant, embedding, HTTP)
3. **Phase 4:** Remove leaderboard functionality
4. **Phase 5:** Refactor game service to stats service

See `docs/prometheus-metrics-implementation.md` for full implementation plan.

---

**Document Status:** Ready for Implementation  
**Last Updated:** [Current Date]  
**Follows:** AI Coding Rules from `tests/test-data/AI_CODING_RULES.md`

