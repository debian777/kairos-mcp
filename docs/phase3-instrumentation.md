# Phase 3: Prometheus Metrics Instrumentation

> **Implementation Guide** — Follow AI Coding Rules strictly  
> **Status:** Ready for Implementation  
> **Dependencies:** Phase 1 and Phase 2 must be complete

---

## Overview

This document provides step-by-step instructions for implementing Phase 3: adding actual metric instrumentation to all tools and services. This phase makes metrics functional by tracking real operations.

**What Phase 3 Delivers:**
- ✅ MCP tools instrumented (kairos_mint, kairos_begin, kairos_next, kairos_attest, kairos_update, kairos_delete)
- ✅ Memory operations instrumented (store, retrieve, search, update, delete)
- ✅ Qdrant operations instrumented
- ✅ Agent stats exposed as metrics (replacing game service calls)
- ✅ HTTP requests instrumented
- ✅ Embedding service instrumented
- ✅ System metrics actively updating

**What Phase 3 Does NOT Include:**
- ❌ Leaderboard removal (Phase 4)
- ❌ Game service refactoring (Phase 5)

---

## AI Coding Rules Compliance

**This implementation MUST follow the AI Coding Rules exactly:**

1. ✅ **CHECK LOCAL DOCUMENTATION** - Use only documented npm scripts from README.md
2. ✅ **ESTABLISH BASELINE** - Run tests, archive baseline, ensure 100% green
3. ✅ **CREATE ISOLATED BRANCH** - `feat/prometheus-metrics-phase3`
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
npm run dev:test > reports/tests/baseline-$(date +%Y%m%d-%H%M%S).log 2>&1
git rev-parse HEAD > reports/tests/baseline-commit.txt
```

**CRITICAL: Only proceed if ALL tests pass with zero failures.**

### 2. Create Isolated Branch

```bash
git checkout -b feat/prometheus-metrics-phase3
```

---

## 3' Bullet Plan

### Scope
- Instrument all MCP tools with metrics
- Instrument memory store operations
- Instrument Qdrant operations
- Replace game service calls with metric updates
- Add HTTP middleware for request metrics
- Instrument embedding service
- Ensure all metrics include tenant_id

### Files to Modify
- `src/tools/kairos_mint.ts`
- `src/tools/kairos_begin.ts`
- `src/tools/kairos_next.ts`
- `src/tools/kairos_attest.ts`
- `src/tools/kairos_update.ts`
- `src/tools/kairos_delete.ts`
- `src/services/memory/store-chain.ts`
- `src/services/memory/store-chain-header.ts`
- `src/services/memory/store-chain-default.ts`
- `src/services/qdrant/service.ts`
- `src/services/qdrant/memory-store.ts`
- `src/services/qdrant/memory-retrieval.ts`
- `src/services/qdrant/search.ts`
- `src/services/game/knowledge-game.ts` (replace leaderboard calls with metrics)
- `src/http-server.ts` or `src/http-mcp-handler.ts` (HTTP middleware)
- `src/services/embedding/service.ts`

### Success Criteria
- ✅ `npm run dev:build` succeeds
- ✅ `npm run dev:test` passes (all tests green)
- ✅ Metrics endpoint shows non-zero values after operations
- ✅ All MCP tools track calls, duration, errors
- ✅ Memory operations tracked
- ✅ Qdrant operations tracked
- ✅ HTTP requests tracked
- ✅ All metrics include tenant_id label
- ✅ All linting passes

**Wait for acknowledgment if scope is unclear.**

---

## Implementation Steps

### Step 1: Instrument MCP Tools

**Pattern for all MCP tools:**

```typescript
// Example: src/tools/kairos_mint.ts
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

export function registerKairosMintTool(server: any, memoryStore: MemoryQdrantStore) {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tenantId = getTenantId(request);
    const toolName = 'kairos_mint';
    
    // Track input size
    const inputSize = JSON.stringify(request.params).length;
    mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
    
    // Start duration timer
    const timer = mcpToolDuration.startTimer({ 
      tool: toolName,
      tenant_id: tenantId 
    });
    
    try {
      // ... existing tool logic ...
      
      // Track success
      mcpToolCalls.inc({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      // Track output size
      const outputSize = JSON.stringify(result).length;
      mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
      
      return result;
    } catch (error) {
      // Track error
      mcpToolCalls.inc({ 
        tool: toolName, 
        status: 'error',
        tenant_id: tenantId 
      });
      mcpToolErrors.inc({ 
        tool: toolName, 
        status: 'error',
        tenant_id: tenantId 
      });
      throw error;
    } finally {
      // End duration timer
      timer({ 
        tool: toolName, 
        status: result ? 'success' : 'error',
        tenant_id: tenantId 
      });
    }
  });
}
```

**Apply this pattern to:**
- `src/tools/kairos_mint.ts`
- `src/tools/kairos_begin.ts`
- `src/tools/kairos_next.ts`
- `src/tools/kairos_attest.ts`
- `src/tools/kairos_update.ts`
- `src/tools/kairos_delete.ts`

### Step 2: Instrument Memory Store Operations

**File:** `src/services/memory/store-chain.ts`

```typescript
import { 
  memoryStore, 
  memoryStoreDuration,
  memoryChainSize 
} from '../metrics/memory-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

// In storeChain method:
async storeChain(docs: string[], llmModelId: string, options: { forceUpdate?: boolean } = {}): Promise<Memory[]> {
  const tenantId = getTenantId(globalThis._mcpRequestContext) || 'default';
  
  const timer = memoryStoreDuration.startTimer({ tenant_id: tenantId });
  
  try {
    // ... existing store logic ...
    
    for (const memory of memories) {
      // Calculate quality score (use existing logic)
      const score = knowledgeGame.calculateGemScore(memory.label, task, type, memory.tags);
      
      // Track memory store with quality
      const quality = score.quality === 'legendary' ? 'excellent' :
                     score.quality === 'rare' ? 'high' :
                     score.quality === 'quality' ? 'standard' : 'basic';
      
      memoryStore.inc({ quality, tenant_id: tenantId });
      
      // Track chain size
      if (memory.protocol) {
        memoryChainSize.observe({ tenant_id: tenantId }, memory.protocol.total);
      }
    }
    
    return memories;
  } finally {
    timer({ tenant_id: tenantId });
  }
}
```

**Apply similar pattern to:**
- `src/services/memory/store-chain-header.ts`
- `src/services/memory/store-chain-default.ts`

### Step 3: Instrument Qdrant Operations

**File:** `src/services/qdrant/service.ts`

```typescript
import {
  qdrantOperations,
  qdrantOperationDuration,
  qdrantConnectionErrors,
  qdrantReconnects,
  qdrantCollectionSize,
  qdrantQueryDuration,
  qdrantUpsertDuration
} from '../metrics/qdrant-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

// In search method:
async search(query: string, limit: number): Promise<any[]> {
  const tenantId = getTenantId(globalThis._mcpRequestContext) || 'default';
  const timer = qdrantQueryDuration.startTimer({ tenant_id: tenantId });
  
  try {
    const results = await this.conn.client.search(/* ... */);
    
    qdrantOperations.inc({ 
      operation: 'search', 
      status: 'success',
      tenant_id: tenantId 
    });
    
    return results;
  } catch (error) {
    qdrantOperations.inc({ 
      operation: 'search', 
      status: 'error',
      tenant_id: tenantId 
    });
    throw error;
  } finally {
    timer({ tenant_id: tenantId });
  }
}

// Similar pattern for: retrieve, upsert, delete, update
```

### Step 4: Replace Game Service Calls with Metrics

**File:** `src/services/game/knowledge-game.ts`

Replace leaderboard updates with metric updates:

```typescript
import {
  agentContributions,
  agentImplementationAttempts,
  agentImplementationSuccesses,
  agentImplementationSuccessRate,
  agentImplementationBonus,
  agentHealerBonus,
  agentRareSuccesses,
  agentQualityScore
} from '../metrics/agent-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

// In processGemDiscovery method:
async processGemDiscovery(llm_model_id: string, gemScore: GemScore, description: string): Promise<void> {
  if (gemScore.total < 20) return;
  
  const tenantId = getTenantId(globalThis._mcpRequestContext) || 'default';
  
  // Map old quality to new quality labels
  const quality = gemScore.quality === 'legendary' ? 'excellent' :
                 gemScore.quality === 'rare' ? 'high' :
                 gemScore.quality === 'quality' ? 'standard' : 'basic';
  
  // Update metrics instead of leaderboard
  agentContributions.inc({ 
    agent_id: llm_model_id, 
    quality, 
    tenant_id: tenantId 
  });
  
  agentQualityScore.observe({ 
    agent_id: llm_model_id, 
    quality_tier: quality,
    tenant_id: tenantId 
  }, gemScore.total);
}

// In calculateImplementationBonus:
async calculateImplementationBonus(
  qualityMetrics: QualityMetrics,
  llm_model_id: string,
  outcome: 'success' | 'partial' | 'failure'
): Promise<number> {
  const tenantId = getTenantId(globalThis._mcpRequestContext) || 'default';
  
  const result = computeImplementationBonus(qualityMetrics, llm_model_id, outcome);
  const { finalBonus, rareSuccess } = result;
  
  if (outcome === 'success' && finalBonus > 0) {
    agentImplementationBonus.inc({ 
      agent_id: llm_model_id, 
      tenant_id: tenantId 
    }, finalBonus);
    
    if (rareSuccess) {
      agentRareSuccesses.inc({ 
        agent_id: llm_model_id, 
        tenant_id: tenantId 
      });
    }
  }
  
  return finalBonus;
}
```

### Step 5: Add HTTP Middleware

**File:** `src/http-server-config.ts` or create `src/http-metrics-middleware.ts`

```typescript
import express from 'express';
import {
  httpRequests,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  httpActiveConnections
} from '../services/metrics/http-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

export function httpMetricsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const tenantId = getTenantId(req) || 'default';
  const method = req.method;
  const route = req.route?.path || req.path;
  
  // Track request size
  const requestSize = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : 0;
  if (requestSize > 0) {
    httpRequestSize.observe({ method, route, tenant_id: tenantId }, requestSize);
  }
  
  // Increment active connections
  httpActiveConnections.inc({ tenant_id: tenantId });
  
  // Start duration timer
  const timer = httpRequestDuration.startTimer({ 
    method, 
    route, 
    tenant_id: tenantId 
  });
  
  // Track response size
  const originalSend = res.send;
  res.send = function(body: any) {
    const responseSize = typeof body === 'string' ? Buffer.byteLength(body) : JSON.stringify(body).length;
    httpResponseSize.observe({ 
      method, 
      route, 
      status: res.statusCode.toString(),
      tenant_id: tenantId 
    }, responseSize);
    return originalSend.call(this, body);
  };
  
  res.on('finish', () => {
    // Track request
    httpRequests.inc({ 
      method, 
      route, 
      status: res.statusCode.toString(),
      tenant_id: tenantId 
    });
    
    // End duration timer
    timer({ 
      method, 
      route, 
      status: res.statusCode.toString(),
      tenant_id: tenantId 
    });
    
    // Decrement active connections
    httpActiveConnections.dec({ tenant_id: tenantId });
  });
  
  next();
}
```

**Update:** `src/http-server-config.ts`

```typescript
import { httpMetricsMiddleware } from './http-metrics-middleware.js';

export function configureMiddleware(app: express.Express) {
  app.use(httpLogger);
  app.use(httpMetricsMiddleware); // Add metrics middleware
  app.use(express.json());
}
```

### Step 6: Instrument Embedding Service

**File:** `src/services/embedding/service.ts`

```typescript
import {
  embeddingRequests,
  embeddingDuration,
  embeddingErrors,
  embeddingVectorSize,
  embeddingBatchSize
} from '../metrics/embedding-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

async generateEmbedding(text: string): Promise<number[]> {
  const tenantId = getTenantId(globalThis._mcpRequestContext) || 'default';
  const provider = this.getProvider(); // 'openai', 'tei', 'local'
  
  const timer = embeddingDuration.startTimer({ provider, tenant_id: tenantId });
  
  try {
    const embedding = await this.provider.generateEmbedding(text);
    
    embeddingRequests.inc({ 
      provider, 
      status: 'success',
      tenant_id: tenantId 
    });
    
    // Track vector size
    const vectorSize = embedding.length * 4; // Assuming float32 (4 bytes)
    embeddingVectorSize.observe({ provider, tenant_id: tenantId }, vectorSize);
    
    return embedding;
  } catch (error) {
    embeddingRequests.inc({ 
      provider, 
      status: 'error',
      tenant_id: tenantId 
    });
    embeddingErrors.inc({ 
      provider, 
      status: 'error',
      tenant_id: tenantId 
    });
    throw error;
  } finally {
    timer({ provider, tenant_id: tenantId });
  }
}
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

### Step 3: Manual Verification

```bash
# Start server
npm run dev:start

# In another terminal, perform operations and check metrics
curl http://localhost:9090/metrics | grep kairos_mcp_tool_calls_total
# Should show non-zero values after tool calls

curl http://localhost:9090/metrics | grep kairos_memory_store_total
# Should show non-zero values after storing memories

curl http://localhost:9090/metrics | grep kairos_http_requests_total
# Should show non-zero values after HTTP requests
```

### Step 4: Linting

```bash
npm run lint
```

---

## Hygiene Checklist

- [ ] Run linter: `npm run lint` (all errors fixed)
- [ ] Remove all debug prints/console.logs
- [ ] Verify all imports are used
- [ ] Check tenant_id is included in all metric calls

---

## Commit

### Commit Message

```
feat(metrics): add Prometheus metrics instrumentation phase 3

- Instrument all MCP tools with metrics (calls, duration, errors, sizes)
- Instrument memory store operations
- Instrument Qdrant operations
- Replace game service leaderboard calls with metric updates
- Add HTTP middleware for request metrics
- Instrument embedding service
- All metrics include tenant_id label

Phase 3 makes metrics functional. Metrics now track real operations.
```

---

## Final Verification

- [x] Baseline archived and was 100% green
- [x] All tests pass
- [x] Metrics show non-zero values after operations
- [x] All metrics include tenant_id
- [x] Linting passes

---

## Handoff

### One-Sentence Summary
Added Prometheus metrics instrumentation to all MCP tools, memory operations, Qdrant operations, HTTP requests, and embedding service. Metrics now track real operations with tenant_id labels.

### Exact Commands to Validate

```bash
npm run dev:build
npm run dev:test
npm run dev:start
curl http://localhost:9090/metrics | grep kairos_
```

### Direct Path to Test Log
`reports/tests/test-{timestamp}.log`

### Commit Hash
`git rev-parse HEAD`

---

**Document Status:** Ready for Implementation  
**Follows:** AI Coding Rules from `tests/test-data/AI_CODING_RULES.md`

