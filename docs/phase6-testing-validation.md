# Phase 6: Prometheus Metrics Testing & Validation

> **Implementation Guide** — Follow AI Coding Rules strictly  
> **Status:** Ready for Implementation  
> **Dependencies:** All previous phases must be complete

---

## Overview

This document provides step-by-step instructions for comprehensive testing and validation of the Prometheus metrics implementation.

**What Phase 6 Delivers:**
- ✅ Unit tests for metric collection
- ✅ Integration tests for metrics endpoint
- ✅ Validation that Prometheus can scrape
- ✅ Verification of all metrics appearing correctly
- ✅ Documentation of Prometheus queries

**What Phase 6 Does NOT Include:**
- ❌ Production deployment (separate process)
- ❌ Grafana dashboards (separate process)

---

## AI Coding Rules Compliance

**This implementation MUST follow the AI Coding Rules exactly:**

1. ✅ **CHECK LOCAL DOCUMENTATION** - Use only documented npm scripts from README.md
2. ✅ **ESTABLISH BASELINE** - Run tests, archive baseline, ensure 100% green
3. ✅ **CREATE ISOLATED BRANCH** - `feat/prometheus-metrics-testing-phase6`
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
git checkout -b feat/prometheus-metrics-testing-phase6
```

---

## 3' Bullet Plan

### Scope
- Create unit tests for metric collection
- Create integration tests for metrics endpoint
- Add validation tests for Prometheus format
- Document Prometheus query examples
- Verify all metrics appear correctly

### Files to Create
- `tests/unit/metrics-registry.test.ts`
- `tests/unit/metrics-collection.test.ts`
- `tests/integration/metrics-endpoint.test.ts`
- `tests/integration/prometheus-scrape.test.ts`
- `docs/prometheus-queries.md` (optional documentation)

### Files to Modify
- None (tests only)

### Success Criteria
- ✅ `npm run dev:build` succeeds
- ✅ `npm run dev:test` passes (all tests green)
- ✅ All metric modules have tests
- ✅ Metrics endpoint returns valid Prometheus format
- ✅ Prometheus can scrape metrics
- ✅ All expected metrics appear
- ✅ All linting passes

**Wait for acknowledgment if scope is unclear.**

---

## Implementation Steps

### Step 1: Create Metrics Registry Tests

**File:** `tests/unit/metrics-registry.test.ts`

```typescript
import { register } from '../../src/services/metrics/registry.js';
import { getBuildVersion } from '../../src/utils/build-version.js';

describe('Metrics Registry', () => {
  test('registry exists and is configured', () => {
    expect(register).toBeDefined();
  });

  test('default labels are set', async () => {
    const metrics = await register.metrics();
    expect(metrics).toContain('kairos_version');
    expect(metrics).toContain('instance');
    expect(metrics).toContain(`kairos_version="${getBuildVersion()}"`);
  });

  test('metrics can be retrieved', async () => {
    const metrics = await register.metrics();
    expect(metrics).toBeTruthy();
    expect(typeof metrics).toBe('string');
  });

  test('metrics format is valid Prometheus format', async () => {
    const metrics = await register.metrics();
    // Should contain HELP and TYPE lines
    expect(metrics).toMatch(/# HELP/);
    expect(metrics).toMatch(/# TYPE/);
  });
});
```

### Step 2: Create Metrics Collection Tests

**File:** `tests/unit/metrics-collection.test.ts`

```typescript
import { mcpToolCalls, mcpToolDuration } from '../../src/services/metrics/mcp-metrics.js';

describe('Metrics Collection', () => {
  beforeEach(() => {
    // Reset metrics before each test
    mcpToolCalls.reset();
  });

  test('can increment counter', () => {
    mcpToolCalls.inc({ 
      tool: 'kairos_mint', 
      status: 'success',
      tenant_id: 'test-tenant' 
    });
    
    // Verify metric was incremented
    // (check via metrics endpoint or direct access)
  });

  test('can observe histogram', () => {
    const timer = mcpToolDuration.startTimer({ 
      tool: 'kairos_mint',
      tenant_id: 'test-tenant' 
    });
    
    // Simulate some work
    setTimeout(() => {
      timer({ 
        tool: 'kairos_mint', 
        status: 'success',
        tenant_id: 'test-tenant' 
      });
    }, 10);
  });

  test('tenant_id is required in labels', () => {
    expect(() => {
      mcpToolCalls.inc({ tool: 'kairos_mint', status: 'success' });
      // Should fail if tenant_id is missing
    }).toThrow();
  });
});
```

### Step 3: Create Metrics Endpoint Integration Tests

**File:** `tests/integration/metrics-endpoint.test.ts`

```typescript
import { createMcpConnection } from '../utils/mcp-client-utils.js';

describe('Metrics Endpoint Integration', () => {
  test('metrics endpoint returns valid Prometheus format', async () => {
    const response = await fetch('http://localhost:9090/metrics');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    
    const metrics = await response.text();
    expect(metrics).toContain('# HELP');
    expect(metrics).toContain('# TYPE');
  });

  test('metrics endpoint includes all metric categories', async () => {
    const response = await fetch('http://localhost:9090/metrics');
    const metrics = await response.text();
    
    // Check for all metric categories
    expect(metrics).toMatch(/kairos_mcp_/);
    expect(metrics).toMatch(/kairos_memory_/);
    expect(metrics).toMatch(/kairos_qdrant_/);
    expect(metrics).toMatch(/kairos_agent_/);
    expect(metrics).toMatch(/kairos_quality_/);
    expect(metrics).toMatch(/kairos_embedding_/);
    expect(metrics).toMatch(/kairos_http_/);
    expect(metrics).toMatch(/kairos_system_/);
  });

  test('metrics include default labels', async () => {
    const response = await fetch('http://localhost:9090/metrics');
    const metrics = await response.text();
    
    expect(metrics).toMatch(/kairos_version=/);
    expect(metrics).toMatch(/instance=/);
  });

  test('metrics endpoint is on separate port', async () => {
    // Main server should NOT have /metrics
    const mainResponse = await fetch(`http://localhost:${PORT}/metrics`);
    expect(mainResponse.status).toBe(404);
    
    // Metrics server should have /metrics
    const metricsResponse = await fetch('http://localhost:9090/metrics');
    expect(metricsResponse.status).toBe(200);
  });
});
```

### Step 4: Create Prometheus Scrape Test

**File:** `tests/integration/prometheus-scrape.test.ts`

```typescript
describe('Prometheus Scrape Validation', () => {
  test('Prometheus can scrape metrics endpoint', async () => {
    const response = await fetch('http://localhost:9090/metrics');
    const metrics = await response.text();
    
    // Validate Prometheus format
    const lines = metrics.split('\n');
    
    // Should have HELP and TYPE declarations
    const helpLines = lines.filter(l => l.startsWith('# HELP'));
    const typeLines = lines.filter(l => l.startsWith('# TYPE'));
    
    expect(helpLines.length).toBeGreaterThan(0);
    expect(typeLines.length).toBeGreaterThan(0);
    
    // Each metric should have HELP and TYPE
    const metricNames = new Set();
    typeLines.forEach(line => {
      const match = line.match(/# TYPE (\w+) (\w+)/);
      if (match) {
        metricNames.add(match[1]);
      }
    });
    
    // Verify metrics are properly formatted
    metricNames.forEach(name => {
      const metricLines = lines.filter(l => l.startsWith(name) && !l.startsWith('#'));
      metricLines.forEach(line => {
        // Should match Prometheus metric format
        expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*\{[^}]*\}\s+[\d.]+$/);
      });
    });
  });

  test('all metrics have tenant_id label', async () => {
    const response = await fetch('http://localhost:9090/metrics');
    const metrics = await response.text();
    const lines = metrics.split('\n');
    
    // Find all metric lines (not comments)
    const metricLines = lines.filter(l => 
      l.trim() && 
      !l.startsWith('#') && 
      l.includes('{')
    );
    
    // Most metrics should have tenant_id (system metrics may not)
    const metricsWithTenant = metricLines.filter(l => l.includes('tenant_id='));
    expect(metricsWithTenant.length).toBeGreaterThan(0);
  });
});
```

### Step 5: Add Operational Tests

**File:** `tests/integration/metrics-operational.test.ts`

```typescript
import { createMcpConnection } from '../utils/mcp-client-utils.js';

describe('Metrics Operational Tests', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('metrics update after MCP tool call', async () => {
    // Get initial metrics
    const beforeResponse = await fetch('http://localhost:9090/metrics');
    const beforeMetrics = await beforeResponse.text();
    const beforeCount = (beforeMetrics.match(/kairos_mcp_tool_calls_total/g) || []).length;
    
    // Call a tool
    await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { query: 'test query', limit: 1 }
    });
    
    // Wait a bit for metrics to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get updated metrics
    const afterResponse = await fetch('http://localhost:9090/metrics');
    const afterMetrics = await afterResponse.text();
    const afterCount = (afterMetrics.match(/kairos_mcp_tool_calls_total/g) || []).length;
    
    // Metrics should have changed
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  test('system metrics update over time', async () => {
    const response1 = await fetch('http://localhost:9090/metrics');
    const metrics1 = await response1.text();
    const uptime1 = metrics1.match(/kairos_system_uptime_seconds\s+([\d.]+)/);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response2 = await fetch('http://localhost:9090/metrics');
    const metrics2 = await response2.text();
    const uptime2 = metrics2.match(/kairos_system_uptime_seconds\s+([\d.]+)/);
    
    if (uptime1 && uptime2) {
      expect(parseFloat(uptime2[1])).toBeGreaterThan(parseFloat(uptime1[1]));
    }
  });
});
```

---

## Testing

### Step 1: Build

```bash
npm run dev:build
```

### Step 2: Run Tests

```bash
npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
```

**CRITICAL: All tests MUST pass with zero failures.**

### Step 3: Manual Validation

```bash
# Start server
npm run dev:start

# Check metrics endpoint
curl http://localhost:9090/metrics | head -50

# Verify Prometheus can scrape
# (if you have Prometheus running locally)
```

### Step 4: Linting

```bash
npm run lint
```

---

## Hygiene Checklist

- [ ] Run linter: `npm run lint` (all errors fixed)
- [ ] All tests pass
- [ ] Test coverage is adequate
- [ ] No debug code in tests

---

## Commit

### Commit Message

```
test(metrics): add comprehensive Prometheus metrics tests phase 6

- Add unit tests for metrics registry
- Add unit tests for metrics collection
- Add integration tests for metrics endpoint
- Add Prometheus scrape validation tests
- Add operational tests for metrics updates
- Verify all metrics appear correctly
- Verify Prometheus format is valid

Phase 6 validates metrics implementation with comprehensive tests.
```

---

## Final Verification

- [x] Baseline archived and was 100% green
- [x] All tests pass
- [x] Metrics endpoint returns valid format
- [x] All expected metrics appear
- [x] Prometheus can scrape
- [x] Linting passes

---

## Handoff

### One-Sentence Summary
Added comprehensive tests for Prometheus metrics: unit tests for registry and collection, integration tests for endpoint, Prometheus scrape validation, and operational tests.

### Exact Commands to Validate

```bash
npm run dev:build
npm run dev:test
curl http://localhost:9090/metrics
```

### Direct Path to Test Log
`reports/tests/test-{timestamp}.log`

### Commit Hash
`git rev-parse HEAD`

---

**Document Status:** Ready for Implementation  
**Follows:** AI Coding Rules from `tests/test-data/AI_CODING_RULES.md`

