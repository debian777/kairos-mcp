# Phase 2: Prometheus Metric Definitions Implementation

> **Implementation Guide** — Follow AI Coding Rules strictly  
> **Status:** Ready for Implementation  
> **Dependencies:** Phase 1 must be complete

---

## Overview

This document provides step-by-step instructions for implementing Phase 2: creating all Prometheus metric definitions. This phase defines all metrics but does not yet instrument the code.

**What Phase 2 Delivers:**
- ✅ All metric collectors defined (Counters, Gauges, Histograms)
- ✅ Metric modules organized by category
- ✅ TypeScript types for metric labels
- ✅ All metrics registered with Prometheus registry
- ✅ Metrics ready for instrumentation (Phase 3)

**What Phase 2 Does NOT Include:**
- ❌ Actual instrumentation of code (Phase 3)
- ❌ Leaderboard removal (Phase 4)
- ❌ Game service refactoring (Phase 5)

---

## AI Coding Rules Compliance

**This implementation MUST follow the AI Coding Rules exactly:**

1. ✅ **CHECK LOCAL DOCUMENTATION** - Use only documented npm scripts from README.md
2. ✅ **ESTABLISH BASELINE** - Run tests, archive baseline, ensure 100% green
3. ✅ **CREATE ISOLATED BRANCH** - `feat/prometheus-metrics-phase2`
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

### 2. Create Isolated Branch

```bash
git checkout -b feat/prometheus-metrics-phase2
```

---

## 3' Bullet Plan

### Scope
- Create all metric definition modules (mcp, memory, qdrant, agent, quality, embedding, http, system, redis)
- Define TypeScript types for all metric labels
- Register all metrics with Prometheus registry
- Export metrics from main index
- Add basic tests for metric definitions

### Files to Create
- `src/services/metrics/mcp-metrics.ts` - MCP tool metrics
- `src/services/metrics/memory-metrics.ts` - Memory operation metrics
- `src/services/metrics/qdrant-metrics.ts` - Qdrant metrics
- `src/services/metrics/agent-metrics.ts` - Agent performance metrics
- `src/services/metrics/quality-metrics.ts` - Quality scoring metrics
- `src/services/metrics/embedding-metrics.ts` - Embedding service metrics
- `src/services/metrics/http-metrics.ts` - HTTP server metrics
- `src/services/metrics/system-metrics.ts` - System metrics
- `src/services/metrics/redis-metrics.ts` - Redis metrics

### Files to Modify
- `src/services/metrics/index.ts` - Export all metric modules
- `src/services/metrics/types.ts` - Add all label types

### Success Criteria
- ✅ `npm run dev:build` succeeds
- ✅ `npm run dev:test` passes (all tests green)
- ✅ All metric modules can be imported
- ✅ Metrics appear in `/metrics` endpoint (even if zero values)
- ✅ All metrics have proper labels including `tenant_id`
- ✅ TypeScript types compile without errors
- ✅ All linting passes

**Wait for acknowledgment if scope is unclear.**

---

## Implementation Steps

### Step 1: Update Metric Types

**File:** `src/services/metrics/types.ts`

Add comprehensive label types:

```typescript
/**
 * TypeScript types for Prometheus metrics labels.
 * All metrics MUST include tenant_id label.
 */

export interface MetricLabels {
  tenant_id: string;
  [key: string]: string | number | undefined;
}

export interface MCPToolLabels extends MetricLabels {
  tool: 'kairos_mint' | 'kairos_begin' | 'kairos_next' | 'kairos_attest' | 'kairos_update' | 'kairos_delete';
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

export interface QdrantOperationLabels extends MetricLabels {
  operation: 'search' | 'retrieve' | 'upsert' | 'delete' | 'update';
  status: 'success' | 'error';
}

export interface QualityLabels extends MetricLabels {
  quality_tier: 'excellent' | 'high' | 'standard' | 'basic';
}

export interface EmbeddingLabels extends MetricLabels {
  provider: 'openai' | 'tei' | 'local';
  status: 'success' | 'error';
}

export interface HTTPLabels extends MetricLabels {
  method: string;
  route: string;
  status: string;
}
```

### Step 2: Create MCP Metrics

**File:** `src/services/metrics/mcp-metrics.ts`

```typescript
import { Counter, Histogram, register } from './registry.js';
import type { MCPToolLabels } from './types.js';

/**
 * MCP Tool Metrics
 * 
 * Tracks all kairos_* tool invocations, duration, errors, and payload sizes.
 */

export const mcpToolCalls = new Counter<MCPToolLabels>({
  name: 'kairos_mcp_tool_calls_total',
  help: 'Total number of MCP tool invocations',
  labelNames: ['tool', 'status', 'tenant_id'],
  registers: [register]
});

export const mcpToolDuration = new Histogram<MCPToolLabels>({
  name: 'kairos_mcp_tool_duration_seconds',
  help: 'MCP tool execution duration in seconds',
  labelNames: ['tool', 'status', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const mcpToolErrors = new Counter<MCPToolLabels>({
  name: 'kairos_mcp_tool_errors_total',
  help: 'Total number of MCP tool execution errors',
  labelNames: ['tool', 'status', 'tenant_id'],
  registers: [register]
});

export const mcpToolInputSize = new Histogram<Pick<MCPToolLabels, 'tool' | 'tenant_id'>>({
  name: 'kairos_mcp_tool_input_size_bytes',
  help: 'MCP tool input payload size in bytes',
  labelNames: ['tool', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});

export const mcpToolOutputSize = new Histogram<Pick<MCPToolLabels, 'tool' | 'tenant_id'>>({
  name: 'kairos_mcp_tool_output_size_bytes',
  help: 'MCP tool output payload size in bytes',
  labelNames: ['tool', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});
```

### Step 3: Create Memory Metrics

**File:** `src/services/metrics/memory-metrics.ts`

```typescript
import { Counter, Histogram, register } from './registry.js';
import type { MemoryOperationLabels } from './types.js';

/**
 * Memory Operation Metrics
 * 
 * Tracks memory store, retrieve, search, update, and delete operations.
 */

export const memoryStore = new Counter<MemoryOperationLabels>({
  name: 'kairos_memory_store_total',
  help: 'Total number of memories stored',
  labelNames: ['quality', 'tenant_id'],
  registers: [register]
});

export const memoryStoreDuration = new Histogram<MemoryOperationLabels>({
  name: 'kairos_memory_store_duration_seconds',
  help: 'Memory storage operation duration in seconds',
  labelNames: ['quality', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const memoryRetrieve = new Counter<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_retrieve_total',
  help: 'Total number of memory retrievals',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memoryRetrieveDuration = new Histogram<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_retrieve_duration_seconds',
  help: 'Memory retrieval operation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

export const memorySearch = new Counter<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_search_total',
  help: 'Total number of search operations',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memorySearchDuration = new Histogram<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_search_duration_seconds',
  help: 'Search operation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const memorySearchResults = new Histogram<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_search_results_count',
  help: 'Number of results returned per search',
  labelNames: ['tenant_id'],
  buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register]
});

export const memoryUpdate = new Counter<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_update_total',
  help: 'Total number of memory updates',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memoryDelete = new Counter<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_delete_total',
  help: 'Total number of memory deletions',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memoryChainSize = new Histogram<Pick<MemoryOperationLabels, 'tenant_id'>>({
  name: 'kairos_memory_chain_size',
  help: 'Number of steps in stored memory chains',
  labelNames: ['tenant_id'],
  buckets: [1, 2, 3, 4, 5, 10, 15, 20, 25, 50],
  registers: [register]
});
```

### Step 4: Create Qdrant Metrics

**File:** `src/services/metrics/qdrant-metrics.ts`

```typescript
import { Counter, Histogram, Gauge, register } from './registry.js';
import type { QdrantOperationLabels } from './types.js';

/**
 * Qdrant Vector Database Metrics
 * 
 * Tracks Qdrant operations, connection status, and performance.
 */

export const qdrantOperations = new Counter<QdrantOperationLabels>({
  name: 'kairos_qdrant_operations_total',
  help: 'Total number of Qdrant operations',
  labelNames: ['operation', 'status', 'tenant_id'],
  registers: [register]
});

export const qdrantOperationDuration = new Histogram<Pick<QdrantOperationLabels, 'operation' | 'tenant_id'>>({
  name: 'kairos_qdrant_operation_duration_seconds',
  help: 'Qdrant operation duration in seconds',
  labelNames: ['operation', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const qdrantConnectionErrors = new Counter<Pick<QdrantOperationLabels, 'tenant_id'>>({
  name: 'kairos_qdrant_connection_errors_total',
  help: 'Total number of Qdrant connection errors',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const qdrantReconnects = new Counter<Pick<QdrantOperationLabels, 'tenant_id'>>({
  name: 'kairos_qdrant_reconnect_total',
  help: 'Total number of Qdrant reconnection attempts',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const qdrantCollectionSize = new Gauge<Pick<QdrantOperationLabels, 'tenant_id'>>({
  name: 'kairos_qdrant_collection_size',
  help: 'Total number of points in Qdrant collection',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const qdrantQueryDuration = new Histogram<Pick<QdrantOperationLabels, 'tenant_id'>>({
  name: 'kairos_qdrant_query_duration_seconds',
  help: 'Qdrant query execution duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const qdrantUpsertDuration = new Histogram<Pick<QdrantOperationLabels, 'tenant_id'>>({
  name: 'kairos_qdrant_upsert_duration_seconds',
  help: 'Qdrant upsert operation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const qdrantVectorDimension = new Gauge({
  name: 'kairos_qdrant_vector_dimension',
  help: 'Vector dimension size',
  registers: [register]
});
```

### Step 5: Create Agent Metrics

**File:** `src/services/metrics/agent-metrics.ts`

```typescript
import { Counter, Gauge, Histogram, register } from './registry.js';
import type { AgentLabels } from './types.js';

/**
 * Agent Performance Metrics
 * 
 * Tracks AI agent contributions, implementation success rates, and bonuses.
 * Replaces old "game stats" with proper Prometheus metrics.
 */

export const agentContributions = new Counter<AgentLabels>({
  name: 'kairos_agent_contributions_total',
  help: 'Total number of knowledge contributions by agent',
  labelNames: ['agent_id', 'quality', 'tenant_id'],
  registers: [register]
});

export const agentImplementationAttempts = new Counter<AgentLabels & { memory_id: string }>({
  name: 'kairos_agent_implementation_attempts_total',
  help: 'Total number of implementation attempts by agent',
  labelNames: ['agent_id', 'memory_id', 'tenant_id'],
  registers: [register]
});

export const agentImplementationSuccesses = new Counter<AgentLabels & { memory_id: string }>({
  name: 'kairos_agent_implementation_successes_total',
  help: 'Total number of successful implementations by agent',
  labelNames: ['agent_id', 'memory_id', 'tenant_id'],
  registers: [register]
});

export const agentImplementationSuccessRate = new Gauge<AgentLabels & { memory_id: string }>({
  name: 'kairos_agent_implementation_success_rate',
  help: 'Implementation success rate (0-1) by agent and memory',
  labelNames: ['agent_id', 'memory_id', 'tenant_id'],
  registers: [register]
});

export const agentImplementationBonus = new Counter<Pick<AgentLabels, 'agent_id' | 'tenant_id'>>({
  name: 'kairos_agent_implementation_bonus_total',
  help: 'Total implementation bonus points by agent',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const agentHealerBonus = new Counter<Pick<AgentLabels, 'agent_id' | 'tenant_id'>>({
  name: 'kairos_agent_healer_bonus_total',
  help: 'Total healer bonus points by agent',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const agentRareSuccesses = new Counter<Pick<AgentLabels, 'agent_id' | 'tenant_id'>>({
  name: 'kairos_agent_rare_successes_total',
  help: 'Total rare success events by agent',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const agentQualityScore = new Histogram<AgentLabels>({
  name: 'kairos_agent_quality_score',
  help: 'Distribution of quality scores by agent',
  labelNames: ['agent_id', 'quality_tier', 'tenant_id'],
  buckets: [0, 5, 10, 15, 20, 25, 30, 35, 40],
  registers: [register]
});
```

### Step 6: Create Quality Metrics

**File:** `src/services/metrics/quality-metrics.ts`

```typescript
import { Counter, Histogram, register } from './registry.js';
import type { QualityLabels, MetricLabels } from './types.js';

/**
 * Quality Metrics
 * 
 * Tracks knowledge quality scoring, validation, and quality distribution.
 */

export const qualityRetrievals = new Counter<MetricLabels & { agent_id: string }>({
  name: 'kairos_quality_retrievals_total',
  help: 'Total number of quality metric retrievals',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualitySuccesses = new Counter<MetricLabels & { agent_id: string }>({
  name: 'kairos_quality_successes_total',
  help: 'Total number of successful quality validations',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualityPartials = new Counter<MetricLabels & { agent_id: string }>({
  name: 'kairos_quality_partials_total',
  help: 'Total number of partial success validations',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualityFailures = new Counter<MetricLabels & { agent_id: string }>({
  name: 'kairos_quality_failures_total',
  help: 'Total number of failed quality validations',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualityScoreCalculationDuration = new Histogram<MetricLabels>({
  name: 'kairos_quality_score_calculation_duration_seconds',
  help: 'Quality score calculation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

export const qualityScoreDistribution = new Histogram<QualityLabels>({
  name: 'kairos_quality_score_distribution',
  help: 'Distribution of quality scores by tier',
  labelNames: ['quality_tier', 'tenant_id'],
  buckets: [0, 5, 10, 15, 20, 25, 30, 35, 40],
  registers: [register]
});

export const qualityBonus = new Counter<MetricLabels & { agent_id: string }>({
  name: 'kairos_quality_bonus_total',
  help: 'Total quality bonus points awarded',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});
```

### Step 7: Create Embedding Metrics

**File:** `src/services/metrics/embedding-metrics.ts`

```typescript
import { Counter, Histogram, register } from './registry.js';
import type { EmbeddingLabels } from './types.js';

/**
 * Embedding Service Metrics
 * 
 * Tracks embedding generation, provider usage, and performance.
 */

export const embeddingRequests = new Counter<EmbeddingLabels>({
  name: 'kairos_embedding_requests_total',
  help: 'Total number of embedding requests',
  labelNames: ['provider', 'status', 'tenant_id'],
  registers: [register]
});

export const embeddingDuration = new Histogram<Pick<EmbeddingLabels, 'provider' | 'tenant_id'>>({
  name: 'kairos_embedding_duration_seconds',
  help: 'Embedding generation duration in seconds',
  labelNames: ['provider', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const embeddingErrors = new Counter<EmbeddingLabels>({
  name: 'kairos_embedding_errors_total',
  help: 'Total number of embedding errors',
  labelNames: ['provider', 'status', 'tenant_id'],
  registers: [register]
});

export const embeddingVectorSize = new Histogram<Pick<EmbeddingLabels, 'provider' | 'tenant_id'>>({
  name: 'kairos_embedding_vector_size_bytes',
  help: 'Generated embedding vector size in bytes',
  labelNames: ['provider', 'tenant_id'],
  buckets: [100, 500, 1000, 2000, 5000, 10000, 20000, 50000],
  registers: [register]
});

export const embeddingBatchSize = new Histogram<Pick<EmbeddingLabels, 'tenant_id'>>({
  name: 'kairos_embedding_batch_size',
  help: 'Batch size for embedding processing',
  labelNames: ['tenant_id'],
  buckets: [1, 2, 5, 10, 25, 50, 100],
  registers: [register]
});
```

### Step 8: Create HTTP Metrics

**File:** `src/services/metrics/http-metrics.ts`

```typescript
import { Counter, Histogram, Gauge, register } from './registry.js';
import type { HTTPLabels } from './types.js';

/**
 * HTTP Server Metrics
 * 
 * Tracks HTTP requests, response times, and payload sizes.
 */

export const httpRequests = new Counter<HTTPLabels>({
  name: 'kairos_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'tenant_id'],
  registers: [register]
});

export const httpRequestDuration = new Histogram<HTTPLabels>({
  name: 'kairos_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const httpRequestSize = new Histogram<Pick<HTTPLabels, 'method' | 'route' | 'tenant_id'>>({
  name: 'kairos_http_request_size_bytes',
  help: 'HTTP request payload size in bytes',
  labelNames: ['method', 'route', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});

export const httpResponseSize = new Histogram<HTTPLabels>({
  name: 'kairos_http_response_size_bytes',
  help: 'HTTP response payload size in bytes',
  labelNames: ['method', 'route', 'status', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});

export const httpActiveConnections = new Gauge<Pick<HTTPLabels, 'tenant_id'>>({
  name: 'kairos_http_active_connections',
  help: 'Current number of active HTTP connections',
  labelNames: ['tenant_id'],
  registers: [register]
});
```

### Step 9: Create System Metrics

**File:** `src/services/metrics/system-metrics.ts`

```typescript
import { Gauge, register } from 'prom-client';

/**
 * System Metrics
 * 
 * Tracks application uptime, memory usage, and CPU usage.
 */

export const systemUptime = new Gauge({
  name: 'kairos_system_uptime_seconds',
  help: 'Application uptime in seconds',
  registers: [register]
});

export const systemMemoryUsage = new Gauge<{ type: string }>({
  name: 'kairos_system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  labelNames: ['type'],
  registers: [register]
});

export const systemCpuUsage = new Gauge({
  name: 'kairos_system_cpu_usage_percent',
  help: 'CPU usage percentage',
  registers: [register]
});

export const systemProcessStartTime = new Gauge({
  name: 'kairos_system_process_start_time_seconds',
  help: 'Process start timestamp (Unix epoch)',
  registers: [register]
});

// Initialize system metrics
const processStartTime = Date.now() / 1000;
systemProcessStartTime.set(processStartTime);

// Update uptime periodically
setInterval(() => {
  systemUptime.set(process.uptime());
  
  const memUsage = process.memoryUsage();
  systemMemoryUsage.set({ type: 'rss' }, memUsage.rss);
  systemMemoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
  systemMemoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
}, 5000); // Update every 5 seconds
```

### Step 10: Create Redis Metrics

**File:** `src/services/metrics/redis-metrics.ts`

```typescript
import { Counter, Histogram, Gauge, register } from './registry.js';
import type { MetricLabels } from './types.js';

/**
 * Redis Metrics
 * 
 * Tracks Redis operations, connection status, and performance.
 * Only created if Redis is used.
 */

export const redisOperations = new Counter<MetricLabels & { operation: string; status: string }>({
  name: 'kairos_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status', 'tenant_id'],
  registers: [register]
});

export const redisOperationDuration = new Histogram<MetricLabels & { operation: string }>({
  name: 'kairos_redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

export const redisConnectionStatus = new Gauge<MetricLabels>({
  name: 'kairos_redis_connection_status',
  help: 'Redis connection status (1=connected, 0=disconnected)',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const redisErrors = new Counter<MetricLabels & { error_type: string }>({
  name: 'kairos_redis_errors_total',
  help: 'Total number of Redis errors',
  labelNames: ['error_type', 'tenant_id'],
  registers: [register]
});
```

### Step 11: Update Metrics Index

**File:** `src/services/metrics/index.ts`

```typescript
/**
 * Metrics service for KAIROS.
 * 
 * This module exports the Prometheus registry and provides
 * access to all metric collectors.
 */

export { register } from './registry.js';
export * from './types.js';

// MCP metrics
export * from './mcp-metrics.js';

// Memory metrics
export * from './memory-metrics.js';

// Qdrant metrics
export * from './qdrant-metrics.js';

// Agent metrics
export * from './agent-metrics.js';

// Quality metrics
export * from './quality-metrics.js';

// Embedding metrics
export * from './embedding-metrics.js';

// HTTP metrics
export * from './http-metrics.js';

// System metrics
export * from './system-metrics.js';

// Redis metrics
export * from './redis-metrics.js';
```

---

## Testing

### Step 1: Build

**Follow CHECK LOCAL DOCUMENTATION: Check README.md for build commands.**

```bash
npm run dev:build
```

**Verify:** Build succeeds without errors.

### Step 2: Run Tests

**Follow CHECK LOCAL DOCUMENTATION: Check README.md for test commands.**

```bash
npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
```

**CRITICAL: All tests MUST pass with zero failures.**

### Step 3: Manual Verification

```bash
# Start server
npm run dev:start

# In another terminal, check metrics endpoint
curl http://localhost:9090/metrics | grep kairos_

# Should see all metric definitions (even if values are zero):
# - kairos_mcp_tool_calls_total
# - kairos_memory_store_total
# - kairos_qdrant_operations_total
# - kairos_agent_contributions_total
# - kairos_quality_retrievals_total
# - kairos_embedding_requests_total
# - kairos_http_requests_total
# - kairos_system_uptime_seconds
# - kairos_redis_operations_total (if Redis is used)
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
- [ ] Verify all imports are used
- [ ] Check TypeScript compilation

---

## Commit

### Commit Message Format

```
feat(metrics): add Prometheus metric definitions phase 2

- Create all metric collector modules (mcp, memory, qdrant, agent, quality, embedding, http, system, redis)
- Define TypeScript types for all metric labels
- Register all metrics with Prometheus registry
- Export all metrics from main index
- All metrics include tenant_id label for multi-tenant support

Phase 2 defines all metrics. Instrumentation in Phase 3.
```

### Proof of Work

**Before committing:**

1. Run tests and capture output:
   ```bash
   npm run dev:test > reports/tests/test-$(date +%Y%m%d-%H%M%S).log 2>&1
   ```

2. Verify test log shows all tests passing

3. Create commit:
   ```bash
   git add .
   git commit -m "feat(metrics): add Prometheus metric definitions phase 2

   - Create all metric collector modules
   - Define TypeScript types for metric labels
   - Register all metrics with Prometheus registry
   - All metrics include tenant_id label

   Phase 2 defines all metrics."
   ```

4. Push to branch:
   ```bash
   git push origin feat/prometheus-metrics-phase2
   ```

---

## Final Verification

**Proof of work is only accepted when:**

- [x] Baseline archived and was 100% green (zero failures)
- [x] Plan followed or deviations documented
- [x] All changes minimal and in scope
- [x] Full test suite green with test log (zero failures)
- [x] Commit exists with clean message
- [x] No disabled or weakened tests
- [x] Linting passes
- [x] All metric modules can be imported
- [x] Metrics appear in `/metrics` endpoint
- [x] All metrics have proper labels including `tenant_id`
- [x] TypeScript compiles without errors

---

## Handoff

### One-Sentence Summary
Added all Prometheus metric definitions: created 9 metric modules (mcp, memory, qdrant, agent, quality, embedding, http, system, redis) with proper TypeScript types and tenant_id labels.

### Exact Commands to Validate

```bash
# Build
npm run dev:build

# Test
npm run dev:test

# Start server
npm run dev:start

# Verify metrics endpoint (in another terminal)
curl http://localhost:9090/metrics | grep kairos_
```

### Direct Path to Test Log
`reports/tests/test-{timestamp}.log`

### Commit Hash
`git rev-parse HEAD` (after commit)

### Remaining Risks
- None for Phase 2 (definitions only, no instrumentation yet)
- Phase 3 will add actual metric instrumentation to code

---

## Next Steps

After Phase 2 is complete and verified:

1. **Phase 3:** Add actual metric instrumentation to all tools and services
2. **Phase 4:** Remove leaderboard functionality
3. **Phase 5:** Refactor game service to stats service
4. **Phase 6:** Testing and validation

See `docs/prometheus-metrics-implementation.md` for full implementation plan.

---

**Document Status:** Ready for Implementation  
**Last Updated:** [Current Date]  
**Follows:** AI Coding Rules from `tests/test-data/AI_CODING_RULES.md`

