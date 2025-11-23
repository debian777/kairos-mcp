# Prometheus Metrics Implementation Plan

> **⚠️ WORK IN PROGRESS - DO NOT IMPLEMENT YET**  
> This document is a comprehensive planning document. Implementation should only begin after this document is finalized and approved.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Metrics Taxonomy](#metrics-taxonomy)
4. [Implementation Plan](#implementation-plan)
5. [Technical Specifications](#technical-specifications)
6. [Migration Strategy](#migration-strategy)

---

## Overview

### Implementation Dependencies

**Can Prometheus metrics and multi-tenant be implemented separately?**

✅ **YES - They can be implemented independently:**

1. **Prometheus Metrics (NOW)**
   - Implement metrics with `tenant_id` label defaulting to `"default"`
   - Works perfectly for single-tenant deployments
   - No dependency on multi-tenant architecture

2. **Multi-Tenant Architecture (LATER)**
   - See `docs/multi-user.md` for full architecture
   - OAuth 2.1 + API Keys
   - Per-user Qdrant collections
   - BYOK (Bring Your Own Key) for embeddings

3. **Integration (WHEN READY)**
   - Update tenant extraction function to use real auth context
   - Metrics automatically support multi-tenant (no code changes needed)
   - All existing metrics with `tenant_id="default"` continue working

**Recommendation:** Implement Prometheus metrics first. Add multi-tenant architecture later. The metrics infrastructure is designed to be future-proof.

### Goals

1. **Replace "game" terminology** with professional metrics terminology
2. **Remove leaderboard** functionality entirely
3. **Implement comprehensive Prometheus metrics** for full observability
4. **Expose metrics on separate port** (as required)
5. **Follow Prometheus best practices** for metric naming and structure
6. **Future-proof for multi-tenant** with tenant_id labels (default to "default" for now)

### Scope

This implementation covers:
- **MCP Tool Metrics**: All kairos_* tool invocations
- **Memory Operations**: Store, retrieve, search, update, delete
- **Vector Database Metrics**: Qdrant operations and performance
- **Model Performance**: AI model contribution tracking (formerly "game stats")
- **Quality Metrics**: Knowledge quality scoring and validation
- **System Metrics**: Application health, resource usage
- **HTTP Metrics**: Request/response tracking

---

## Architecture Decisions ⚠️ PENDING

> **Status:** These decisions are pending review and approval before implementation.

### 1. Redis vs In-Memory for Metrics

**Recommendation: In-Memory Only**

**Rationale:**
- Prometheus scrapes metrics periodically (default 15s intervals)
- Prometheus is designed to handle gaps in metrics (e.g., during restarts)
- In-memory is simpler, faster, and reduces dependencies
- Standard practice: Most Prometheus exporters use in-memory counters
- Redis adds complexity without significant benefit for metrics

**Exception:** If we need to persist critical business counters (not metrics) across restarts, we can:
- Keep Redis for business logic counters (implementation bonuses, rare successes)
- Expose current values as Prometheus gauges (not counters)
- Prometheus will track the time-series, Redis tracks the absolute value

**Decision:** Use in-memory for all Prometheus metrics. Keep Redis only for business-critical counters that need persistence (if any).

### 2. Metrics Port Separation

**Requirement:** Metrics MUST run on different port than application.

**Decision:** Metrics are **ONLY** exposed on a separate dedicated port. The main application port will **NOT** expose metrics.

**Rationale:**
- **Production isolation**: Separates observability traffic from application traffic
- **Security**: Metrics endpoint can be restricted to internal networks only
- **Performance**: Metrics scraping doesn't impact application performance
- **Best practice**: Standard pattern for production Prometheus deployments
- **Network segmentation**: Allows different firewall rules for metrics vs application

**Implementation:**
- Main application: Current port (from `PORT` env var) - **NO metrics endpoint**
- Metrics endpoint: **ONLY** on separate port (e.g., `METRICS_PORT` env var, default 9090)
- Separate Express server instance for metrics endpoint
- Metrics server **ONLY** exposes `/metrics` endpoint (Prometheus format)
- Main application server does **NOT** have `/metrics` route

**Production Benefits:**
- Metrics port can be exposed only to Prometheus servers (internal network)
- Application port remains clean without metrics overhead
- Easier to scale metrics collection independently
- Clear separation of concerns

### 3. Quality Scoring as Metrics

**Decision: Include quality scores as metrics**

**Rationale:**
- Quality scores are objective measurements (specificity, expert value, etc.)
- They provide valuable insights into knowledge quality trends
- Easy to interpret: single numeric value per contribution
- Can track quality distribution over time
- Useful for alerting on quality degradation

**Implementation:**
- Expose quality scores as histograms (distribution of scores)
- Track quality labels (excellent/high/standard/basic) as counters
- Track scoring calculation duration as histogram

### 4. Multi-Tenant Support

**Decision: All metrics MUST include `tenant_id` label**

**Rationale:**
- KAIROS will support multi-tenant deployments (see `docs/multi-user.md`)
- Metrics must be isolated per tenant for security and billing
- Enables per-tenant monitoring and alerting
- Future-proof: Metrics ready when multi-tenant is implemented

**Implementation Strategy:**
- **Phase 1 (Now)**: Implement metrics with `tenant_id` label, default to `"default"` for single-tenant
- **Phase 2 (Later)**: Add full multi-tenant architecture (OAuth, per-user collections, etc.)
- **Phase 3**: Update tenant extraction to use real auth/user context

**Current Implementation:**
- `tenant_id` label on ALL metrics (mandatory)
- Default to `"default"` for single-tenant deployments (no multi-tenant yet)
- Simple tenant extraction function (returns `"default"` for now)
- When multi-tenant is added, only tenant extraction logic needs updating

**Dependency Note:**
- ✅ **Can implement Prometheus metrics NOW** with default tenant_id
- ✅ **Multi-tenant architecture can be added LATER** without changing metrics
- ✅ **Metrics infrastructure is future-proof** and ready for multi-tenant

### 5. Mandatory Metric Labels

**Decision: Standard labels on all metrics**

**Required Labels:**
- `tenant_id` - Tenant identifier (mandatory for multi-tenant)
- `kairos_version` - Application version (from build version)
- `instance` - Server instance identifier (hostname or container ID)

**Implementation:**
- Set via `register.setDefaultLabels()` in registry
- Automatically applied to all metrics
- Can be overridden per-metric if needed

### 6. Terminology Changes

| Old Term | New Term | Rationale |
|----------|----------|-----------|
| `game` | `stats` or `metrics` | Professional terminology |
| `gem` | `contribution` or `knowledge` | Neutral, descriptive |
| `legendary/rare/quality/common` | `excellent/high/standard/basic` | Professional quality tiers |
| `leaderboard` | **REMOVED** | Replaced by Prometheus queries |
| `achievements` | **REMOVED** | Not needed for metrics |
| `model` | `agent` or `model` | Use `agent` for consistency (LLM agents are agents) |

---

## Metrics Taxonomy

### Metric Naming Convention

**Format:** `kairos_<component>_<metric>_<type>`

**Rules:**
- Prefix: `kairos_` (all metrics)
- Component: `mcp`, `memory`, `qdrant`, `agent`, `quality`, `system`, `http`
- Metric name: snake_case, descriptive
- Type suffix: `_total` (counters), `_seconds` (duration), `_bytes` (size), `_ratio` (0-1), or no suffix (gauge)

**Examples:**
- `kairos_mcp_tool_calls_total{tool="kairos_mint",status="success",tenant_id="default"}`
- `kairos_memory_store_duration_seconds{quality="excellent",tenant_id="default"}`
- `kairos_agent_contributions_total{agent_id="claude-3-opus",quality="excellent",tenant_id="default"}`

**Note:** All examples show `tenant_id` label which is mandatory on all metrics.

### Metric Types

1. **Counter**: Cumulative values that only increase (e.g., total requests)
2. **Gauge**: Values that can go up or down (e.g., active connections)
3. **Histogram**: Distribution of values (e.g., request duration, quality scores)
4. **Summary**: Similar to histogram but with quantiles (use sparingly)

---

## Comprehensive Metrics List

### 1. MCP Tool Metrics

**Category:** `kairos_mcp_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_mcp_tool_calls_total` | Counter | `tool`, `status` | Total MCP tool invocations |
| `kairos_mcp_tool_duration_seconds` | Histogram | `tool`, `status` | Tool execution duration |
| `kairos_mcp_tool_errors_total` | Counter | `tool`, `error_type` | Tool execution errors |
| `kairos_mcp_tool_input_size_bytes` | Histogram | `tool` | Input payload size |
| `kairos_mcp_tool_output_size_bytes` | Histogram | `tool` | Output payload size |

**Tools tracked:**
- `kairos_mint`
- `kairos_begin`
- `kairos_next`
- `kairos_attest`
- `kairos_update`
- `kairos_delete`

**Status values:**
- `success`
- `error`
- `timeout`

### 2. Memory Operations Metrics

**Category:** `kairos_memory_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_memory_store_total` | Counter | `model`, `quality` | Total memories stored |
| `kairos_memory_store_duration_seconds` | Histogram | `quality` | Memory storage duration |
| `kairos_memory_retrieve_total` | Counter | `status` | Total memory retrievals |
| `kairos_memory_retrieve_duration_seconds` | Histogram | - | Memory retrieval duration |
| `kairos_memory_search_total` | Counter | `status` | Total search operations |
| `kairos_memory_search_duration_seconds` | Histogram | `query_type` | Search operation duration |
| `kairos_memory_search_results_count` | Histogram | - | Number of results per search |
| `kairos_memory_update_total` | Counter | `status` | Total memory updates |
| `kairos_memory_delete_total` | Counter | `status` | Total memory deletions |
| `kairos_memory_chain_size` | Histogram | - | Number of steps in stored chains |

**Quality labels:**
- `excellent` (30+ points)
- `high` (25-29 points)
- `standard` (20-24 points)
- `basic` (15-19 points)

### 3. Vector Database (Qdrant) Metrics

**Category:** `kairos_qdrant_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_qdrant_operations_total` | Counter | `operation`, `status` | Total Qdrant operations |
| `kairos_qdrant_operation_duration_seconds` | Histogram | `operation` | Qdrant operation duration |
| `kairos_qdrant_connection_errors_total` | Counter | `error_type` | Connection errors |
| `kairos_qdrant_reconnect_total` | Counter | - | Reconnection attempts |
| `kairos_qdrant_collection_size` | Gauge | - | Total points in collection |
| `kairos_qdrant_query_duration_seconds` | Histogram | `query_type` | Query execution duration |
| `kairos_qdrant_upsert_duration_seconds` | Histogram | - | Upsert operation duration |
| `kairos_qdrant_vector_dimension` | Gauge | - | Vector dimension size |

**Operations:**
- `search`
- `retrieve`
- `upsert`
- `delete`
- `update`

### 4. Agent Performance Metrics

**Category:** `kairos_agent_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_agent_contributions_total` | Counter | `agent_id`, `quality`, `tenant_id` | Total knowledge contributions |
| `kairos_agent_implementation_attempts_total` | Counter | `agent_id`, `memory_id`, `tenant_id` | Implementation attempts |
| `kairos_agent_implementation_successes_total` | Counter | `agent_id`, `memory_id`, `tenant_id` | Successful implementations |
| `kairos_agent_implementation_success_rate` | Gauge | `agent_id`, `memory_id`, `tenant_id` | Success rate (0-1) |
| `kairos_agent_implementation_bonus_total` | Counter | `agent_id`, `tenant_id` | Total implementation bonus points |
| `kairos_agent_healer_bonus_total` | Counter | `agent_id`, `tenant_id` | Total healer bonus points |
| `kairos_agent_rare_successes_total` | Counter | `agent_id`, `tenant_id` | Rare success events |
| `kairos_agent_quality_score` | Histogram | `agent_id`, `quality_tier`, `tenant_id` | Distribution of quality scores |

**Note:** 
- These replace the old "game stats" but are now proper Prometheus metrics
- `agent_id` refers to LLM model identifier (e.g., "claude-3-opus", "gpt-4-turbo")
- All metrics include mandatory `tenant_id` label for multi-tenant isolation

### 5. Quality Metrics

**Category:** `kairos_quality_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_quality_retrievals_total` | Counter | `model` | Total quality metric retrievals |
| `kairos_quality_successes_total` | Counter | `model` | Successful quality validations |
| `kairos_quality_partials_total` | Counter | `model` | Partial success validations |
| `kairos_quality_failures_total` | Counter | `model` | Failed quality validations |
| `kairos_quality_score_calculation_duration_seconds` | Histogram | - | Quality score calculation time |
| `kairos_quality_score_distribution` | Histogram | `quality_tier` | Distribution of quality scores |
| `kairos_quality_bonus_total` | Counter | `model` | Total quality bonus points awarded |

**Quality tiers:**
- `excellent`
- `high`
- `standard`
- `basic`

### 6. Embedding Service Metrics

**Category:** `kairos_embedding_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_embedding_requests_total` | Counter | `provider`, `status` | Total embedding requests |
| `kairos_embedding_duration_seconds` | Histogram | `provider` | Embedding generation duration |
| `kairos_embedding_errors_total` | Counter | `provider`, `error_type` | Embedding errors |
| `kairos_embedding_vector_size_bytes` | Histogram | `provider` | Generated vector size |
| `kairos_embedding_batch_size` | Histogram | - | Batch processing size |

**Providers:**
- `openai`
- `tei`
- `local`

### 7. HTTP Server Metrics

**Category:** `kairos_http_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_http_requests_total` | Counter | `method`, `route`, `status` | Total HTTP requests |
| `kairos_http_request_duration_seconds` | Histogram | `method`, `route`, `status` | Request duration |
| `kairos_http_request_size_bytes` | Histogram | `method`, `route` | Request payload size |
| `kairos_http_response_size_bytes` | Histogram | `method`, `route`, `status` | Response payload size |
| `kairos_http_active_connections` | Gauge | - | Current active connections |

**Routes:**
- `/health`
- `/mcp`
- `/api/kairos_mint/raw`
- `/metrics` (metrics endpoint itself)

### 8. System Metrics

**Category:** `kairos_system_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_system_uptime_seconds` | Gauge | - | Application uptime |
| `kairos_system_memory_usage_bytes` | Gauge | `type` | Memory usage (rss, heapTotal, heapUsed) |
| `kairos_system_cpu_usage_percent` | Gauge | - | CPU usage percentage |
| `kairos_system_process_start_time_seconds` | Gauge | - | Process start timestamp |

**Note:** These complement Node.js built-in metrics but are KAIROS-specific.

### 9. Redis Metrics (if kept)

**Category:** `kairos_redis_*`

| Metric | Type | Labels | Description |
|-------|------|--------|-------------|
| `kairos_redis_operations_total` | Counter | `operation`, `status` | Total Redis operations |
| `kairos_redis_operation_duration_seconds` | Histogram | `operation` | Redis operation duration |
| `kairos_redis_connection_status` | Gauge | - | Connection status (1=connected, 0=disconnected) |
| `kairos_redis_errors_total` | Counter | `error_type` | Redis errors |

**Operations:**
- `get`
- `set`
- `hgetall`
- `hsetall`
- `del`

---

## Implementation Plan

### Phase 1: Infrastructure Setup

1. **Install prom-client**
   ```bash
   npm install prom-client
   npm install --save-dev @types/prom-client
   ```

2. **Create metrics service structure**
   ```
   src/services/metrics/
   ├── index.ts              # Main metrics service & registry
   ├── registry.ts           # Prometheus registry setup
   ├── mcp-metrics.ts        # MCP tool metrics
   ├── memory-metrics.ts     # Memory operation metrics
   ├── qdrant-metrics.ts     # Qdrant metrics
   ├── agent-metrics.ts      # Agent performance metrics (renamed from model-metrics)
   ├── quality-metrics.ts   # Quality scoring metrics
   ├── embedding-metrics.ts # Embedding service metrics
   ├── http-metrics.ts      # HTTP server metrics
   ├── system-metrics.ts    # System metrics
   └── redis-metrics.ts     # Redis metrics (if kept)
   ```

3. **Create tenant context utility**
   ```
   src/utils/tenant-context.ts  # Helper to extract tenant_id from requests
   ```

3. **Create separate metrics server**
   ```
   src/metrics-server.ts     # Separate Express server for /metrics
   ```
   **Important:** This is a completely separate Express server instance running on a different port. The main application server will NOT expose metrics.

4. **Update configuration**
   - Add `METRICS_PORT` environment variable
   - Default: 9090
   - Update `src/config.ts`
   - **Ensure main application server does NOT have `/metrics` route**

### Phase 2: Core Metrics Implementation

1. **Tenant Context Utility** (`src/utils/tenant-context.ts`)
   - Extract `tenant_id` from request headers/auth tokens
   - Default to `default` for single-tenant deployments
   - Support multi-tenant isolation
   - Example: Extract from `X-Tenant-ID` header or OAuth token claims

2. **Registry Setup** (`src/services/metrics/registry.ts`)
   - Create Prometheus registry
   - Configure default labels (`kairos_version`, `instance`)
   - Set up OpenMetrics format support
   - Note: `tenant_id` is NOT a default label (must be per-metric)

3. **Metrics Service** (`src/services/metrics/index.ts`)
   - Initialize all metric collectors
   - Provide accessor methods
   - Export registry for metrics endpoint

4. **Metrics Server** (`src/metrics-server.ts`)
   - Separate Express app
   - Single route: `GET /metrics`
   - Returns Prometheus text format
   - Runs on separate port

### Phase 3: Instrumentation

1. **MCP Tools** (`src/tools/*.ts`)
   - Add metrics to `kairos_mint`, `kairos_begin`, `kairos_next`, `kairos_attest`, `kairos_update`, `kairos_delete`
   - Track duration, success/error, input/output size
   - **Extract `tenant_id` from request context** and include in all metric labels

2. **Memory Store** (`src/services/memory/store.ts`)
   - Instrument store, retrieve, search, update, delete operations
   - Track quality labels
   - **Include `tenant_id` in all memory operation metrics**

3. **Qdrant Service** (`src/services/qdrant/service.ts`)
   - Instrument all Qdrant operations
   - Track connection status, errors, reconnects

4. **Agent Stats** (`src/services/game/knowledge-game.ts` → refactor)
   - Replace "game" service with metrics-based tracking
   - Remove leaderboard logic
   - Keep scoring/bonus calculation (business logic)
   - Expose as Prometheus metrics
   - Update terminology: `model` → `agent`
   - Add `tenant_id` to all agent metrics

5. **HTTP Server** (`src/http-server.ts`, `src/http-mcp-handler.ts`)
   - Add HTTP middleware for request metrics
   - Track all routes

6. **Embedding Service** (`src/services/embedding/service.ts`)
   - Track embedding generation
   - Track provider usage

### Phase 4: Remove Leaderboard

1. **Delete leaderboard routes**
   - Remove `/leaderboard` from `http-api-routes.ts`
   - Remove `/api/leaderboard` from `http-api-routes.ts`
   - Remove `/api/achievements` from `http-api-routes.ts`

2. **Delete leaderboard files**
   - `src/resources/content/leaderboard*.ts`
   - `src/services/game/leaderboard-api.ts`
   - `src/services/game/leaderboard.ts`

3. **Update health routes**
   - Remove leaderboard reference from `http-health-routes.ts`

### Phase 5: Refactor Game Service

1. **Rename directory and files**
   - `src/services/game/` → `src/services/stats/`
   - All files in directory keep same names (except deletions)

2. **Rename classes, types, and instances**
   - `KnowledgeGameService` → `ModelStatsService`
   - `knowledgeGame` instance → `modelStats`
   - `GameStats` interface → `ModelStats`
   - `GameLeaderboard` interface → `ModelLeaderboard` (or remove if not needed)
   - `resolveGameInfo()` function → `resolveStatsInfo()` or `resolveQualityInfo()`
   - `gameInfo` parameter → `statsInfo` or `qualityInfo`

3. **Update all imports** (88+ references found)
   - `src/tools/kairos_attest.ts` - import and usage
   - `src/services/qdrant/memory-updates.ts` - dynamic import
   - `src/services/memory/store-chain.ts` - import and usage
   - `src/services/memory/store-chain-header.ts` - import and usage
   - `src/services/memory/store-chain-default.ts` - import and usage
   - `src/resources/memory-resource.ts` - `resolveGameInfo()` function
   - `src/http-api-routes.ts` - leaderboard API imports (will be removed)
   - `src/services/game/index.ts` - re-exports

4. **Update Redis keys**
   - `game:leaderboard` → `stats:leaderboard` (or remove if not using Redis)
   - `game:implementationBonusTotals` → `stats:implementationBonusTotals` (or remove)
   - `game:rareSuccessCounts` → `stats:rareSuccessCounts` (or remove)

5. **Update comments and documentation**
   - `src/services/redis.ts` - comment about "game data"
   - `src/services/game/knowledge-game.ts` - file header comments
   - `src/services/game/types.ts` - file header comments
   - `src/services/game/scoring.ts` - file header comments
   - `src/services/memory/store-chain.ts` - comments mentioning "game"
   - `src/services/memory/store-chain-header.ts` - comments mentioning "game"
   - `src/services/memory/store-chain-default.ts` - comments mentioning "game"
   - `src/resources/memory-resource.ts` - comments mentioning "game"

6. **Update function names and methods**
   - `getLeaderboard()` → Remove (replaced by Prometheus metrics)
   - `getAgentStats()` → Keep but rename to `getModelStats()`
   - `processGemDiscovery()` → `processContribution()` or `processKnowledgeContribution()`
   - `calculateGemScore()` → `calculateQualityScore()` or `calculateKnowledgeScore()`
   - `calculateStepGemMetadata()` → `calculateStepQualityMetadata()`

7. **Update test files**
   - `tests/unit/markdown-structure-json-string.test.ts` - update path reference

8. **Keep business logic, expose as metrics**
   - Keep scoring calculation (`scoring.ts` - rename to neutral terms)
   - Keep bonus calculation (`bonuses.ts`, `healer.ts`)
   - Remove motivation/hype (`motivation.ts` - delete or simplify)
   - Remove achievements (`achievements.ts` - delete)
   - Expose all counters as Prometheus metrics

9. **Remove "gem" terminology**
   - `GemScore` → `QualityScore` or `KnowledgeScore`
   - `gem` variables → `contribution` or `knowledge`
   - `calculateGemScore` → `calculateQualityScore`
   - All "gem" references in comments

10. **Update quality labels**
    - `legendary` → `excellent`
    - `rare` → `high`
    - `quality` → `standard`
    - `common` → `basic`
    - Update all enum/type definitions

### Phase 6: Testing & Validation

1. **Unit tests**
   - Test metric collection
   - Test metric formatting
   - Test registry export

2. **Integration tests**
   - Verify metrics endpoint works
   - Verify metrics are exposed correctly
   - Verify Prometheus can scrape

3. **Validation**
   - Run Prometheus locally
   - Scrape metrics endpoint
   - Verify all metrics appear
   - Check metric labels and values

---

## Technical Specifications

### Metrics Server Implementation

**Important:** This is a **completely separate Express server** running on a different port. The main application server should **NOT** expose a `/metrics` endpoint.

```typescript
// src/metrics-server.ts
import express from 'express';
import { register } from './services/metrics/registry.js';
import { structuredLogger } from './utils/structured-logger.js';

/**
 * Start dedicated metrics server on separate port.
 * This server ONLY exposes /metrics endpoint for Prometheus scraping.
 * 
 * Production benefits:
 * - Complete isolation from application traffic
 * - Can be restricted to internal networks only
 * - No impact on application performance
 * - Standard Prometheus deployment pattern
 */
export function startMetricsServer(port: number): void {
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

**Note:** The main application server (`src/http-server.ts`) should **NOT** have a `/metrics` route. All metrics are exclusively available on the dedicated metrics port.

### Registry Setup

```typescript
// src/services/metrics/registry.ts
import { Registry } from 'prom-client';
import { getBuildVersion } from '../../utils/build-version.js';
import os from 'os';

export const register = new Registry();

// Set mandatory default labels on all metrics
register.setDefaultLabels({
  service: 'kairos',
  kairos_version: getBuildVersion(),
  instance: process.env.INSTANCE_ID || os.hostname() || 'unknown'
});

// Note: tenant_id is NOT a default label - it must be set per-metric
// based on request context to ensure proper tenant isolation

// Collect default Node.js metrics (optional)
// import { collectDefaultMetrics } from 'prom-client';
// collectDefaultMetrics({ register });
```

### Example Metric Definition

```typescript
// src/services/metrics/mcp-metrics.ts
import { Counter, Histogram, register } from '../registry.js';

export const mcpToolCalls = new Counter({
  name: 'kairos_mcp_tool_calls_total',
  help: 'Total number of MCP tool invocations',
  labelNames: ['tool', 'status', 'tenant_id'], // tenant_id is mandatory
  registers: [register]
});

export const mcpToolDuration = new Histogram({
  name: 'kairos_mcp_tool_duration_seconds',
  help: 'MCP tool execution duration in seconds',
  labelNames: ['tool', 'status', 'tenant_id'], // tenant_id is mandatory
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});
```

**Note:** All metrics must include `tenant_id` in `labelNames`. Default labels (`kairos_version`, `instance`) are automatically applied via registry.

### Usage Example

```typescript
// In kairos_mint.ts
import { mcpToolCalls, mcpToolDuration } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js'; // Helper to extract tenant from request

export function registerKairosMintTool(server: any, memoryStore: MemoryQdrantStore) {
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    // ... tool registration
  });
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Extract tenant_id from request context
    const tenantId = getTenantId(request) || 'default';
    
    const timer = mcpToolDuration.startTimer({ 
      tool: 'kairos_mint',
      tenant_id: tenantId 
    });
    
    try {
      // ... tool logic
      mcpToolCalls.inc({ 
        tool: 'kairos_mint', 
        status: 'success',
        tenant_id: tenantId 
      });
      return result;
    } catch (error) {
      mcpToolCalls.inc({ 
        tool: 'kairos_mint', 
        status: 'error',
        tenant_id: tenantId 
      });
      throw error;
    } finally {
      timer({ 
        tool: 'kairos_mint', 
        status: result ? 'success' : 'error',
        tenant_id: tenantId 
      });
    }
  });
}
```

**Note:** `tenant_id` must be extracted from request context (headers, auth tokens, etc.) and included in all metric labels for proper multi-tenant isolation.

### Configuration

```typescript
// src/config.ts
export const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9090', 10);
export const PROMETHEUS_SCRAPE_INTERVAL = process.env.PROMETHEUS_SCRAPE_INTERVAL || '15s';
export const INSTANCE_ID = process.env.INSTANCE_ID || os.hostname() || 'unknown';
```

**Environment Variables:**
- `METRICS_PORT` - Port for metrics server (default: 9090)
- `PROMETHEUS_SCRAPE_INTERVAL` - Recommended scrape interval (default: 15s)
- `INSTANCE_ID` - Server instance identifier (default: hostname)

### Main Server Integration

**Critical:** The main application server (`src/http-server.ts`) should **NOT** expose a `/metrics` endpoint. Metrics are exclusively available on the dedicated metrics port.

```typescript
// src/index.ts
import { startMetricsServer } from './metrics-server.js';
import { METRICS_PORT } from './config.js';
import { structuredLogger } from './utils/structured-logger.js';

async function main(): Promise<void> {
  // ... existing initialization (memory store, MCP server, etc.)
  
  // Start dedicated metrics server on separate port
  // This runs independently from the main application server
  startMetricsServer(METRICS_PORT);
  
  structuredLogger.info(`Application server: ${PORT}`);
  structuredLogger.info(`Metrics server: ${METRICS_PORT} (isolated)`);
  
  // ... rest of initialization (start main HTTP server)
}
```

**Production Deployment:**
- Main application port: Exposed to application clients
- Metrics port: Exposed only to Prometheus servers (internal network)
- Firewall rules: Restrict metrics port to monitoring infrastructure only

### Tenant Context Extraction

**Current Implementation (Single-Tenant):**
```typescript
// src/utils/tenant-context.ts
/**
 * Extract tenant_id from request context.
 * 
 * CURRENT: Returns 'default' for single-tenant deployments.
 * FUTURE: Will extract from OAuth tokens, API keys, or headers when multi-tenant is implemented.
 * 
 * See docs/multi-user.md for future multi-tenant architecture.
 */
export function getTenantId(request: any): string {
  // TODO: When multi-tenant is implemented, add extraction logic:
  // - X-Tenant-ID header (for API key requests)
  // - OAuth token claims (for authenticated users)
  // - Request metadata (for MCP requests)
  
  // For now, always return default for single-tenant
  return process.env.DEFAULT_TENANT_ID || 'default';
}
```

**Future Implementation (Multi-Tenant):**
```typescript
// When multi-tenant architecture is added (docs/multi-user.md):
export function getTenantId(request: any): string {
  // Try header first (API keys)
  const headerTenant = request?.headers?.['x-tenant-id'] || 
                       request?.headers?.['X-Tenant-ID'];
  if (headerTenant) return headerTenant;
  
  // Try from OAuth token claims (authenticated users)
  const tokenTenant = request?.auth?.tenant_id || 
                      request?.user?.tenant_id;
  if (tokenTenant) return tokenTenant;
  
  // Try from MCP request metadata
  const mcpTenant = request?.params?.tenant_id ||
                    request?.metadata?.tenant_id;
  if (mcpTenant) return mcpTenant;
  
  // Fallback to default
  return process.env.DEFAULT_TENANT_ID || 'default';
}
```

**Implementation Phases:**
1. **Now**: Simple function returning `"default"` - metrics work immediately
2. **Later**: Add multi-tenant architecture (OAuth, per-user collections)
3. **Then**: Update this function to extract real tenant_id from auth context
4. **Result**: Metrics automatically support multi-tenant without code changes

---

## Complete "Game" Terminology Removal Checklist

This section provides a comprehensive list of all files and references that need to be updated during the refactoring.

### Files Requiring Updates

#### Core Service Files (Rename Directory)
- [ ] `src/services/game/knowledge-game.ts` → `src/services/stats/model-stats.ts`
- [ ] `src/services/game/types.ts` → `src/services/stats/types.ts`
- [ ] `src/services/game/scoring.ts` → `src/services/stats/scoring.ts`
- [ ] `src/services/game/bonuses.ts` → `src/services/stats/bonuses.ts`
- [ ] `src/services/game/healer.ts` → `src/services/stats/healer.ts`
- [ ] `src/services/game/protocol.ts` → `src/services/stats/protocol.ts`
- [ ] `src/services/game/index.ts` → `src/services/stats/index.ts`
- [ ] `src/services/game/leaderboard.ts` → **DELETE** (replaced by metrics)
- [ ] `src/services/game/leaderboard-api.ts` → **DELETE** (replaced by metrics)
- [ ] `src/services/game/achievements.ts` → **DELETE** (not needed)
- [ ] `src/services/game/motivation.ts` → **DELETE** or simplify (remove hype)

#### Files with Import References
- [ ] `src/tools/kairos_attest.ts` (4 references)
  - Line 4: `import { knowledgeGame }`
  - Line 83: `knowledgeGame.calculateImplementationBonus`
  - Line 114: `knowledgeGame.calculateStepGemMetadata`
  - Line 133: `knowledgeGame.processQualityFeedback`
  - Line 143: `knowledgeGame.updateImplementationBonus`

- [ ] `src/services/qdrant/memory-updates.ts` (2 references)
  - Line 83: Dynamic import `../game/knowledge-game.js`
  - Line 84: `knowledgeGame.calculateStepGemMetadata`

- [ ] `src/services/memory/store-chain.ts` (6 references)
  - Line 10: `import { knowledgeGame }`
  - Line 127: `knowledgeGame.calculateStepGemMetadata`
  - Line 143: Comment "basic classification for game"
  - Line 180: Comment "Update Knowledge Mining Game leaderboard"
  - Line 184: `knowledgeGame.calculateGemScore`
  - Line 185: `knowledgeGame.processGemDiscovery`
  - Line 276: `knowledgeGame.calculateStepGemMetadata`
  - Line 327: Comment "Update Knowledge Mining Game leaderboard"
  - Line 334: `knowledgeGame.calculateGemScore`
  - Line 335: `knowledgeGame.processGemDiscovery`

- [ ] `src/services/memory/store-chain-header.ts` (5 references)
  - Line 8: `import { knowledgeGame }`
  - Line 106: `knowledgeGame.calculateStepGemMetadata`
  - Line 122: Comment "basic classification for game"
  - Line 159: Comment "Update Knowledge Mining Game leaderboard"
  - Line 163: `knowledgeGame.calculateGemScore`
  - Line 164: `knowledgeGame.processGemDiscovery`

- [ ] `src/services/memory/store-chain-default.ts` (4 references)
  - Line 10: `import { knowledgeGame }`
  - Line 124: `knowledgeGame.calculateStepGemMetadata`
  - Line 175: Comment "Update Knowledge Mining Game leaderboard"
  - Line 182: `knowledgeGame.calculateGemScore`
  - Line 183: `knowledgeGame.processGemDiscovery`

- [ ] `src/resources/memory-resource.ts` (5 references)
  - Line 57: Comment "Resolve game info"
  - Line 58: `resolveGameInfo()` function call
  - Line 60: `game` parameter
  - Line 75: `gameInfo` type definition
  - Line 165: Comment "Resolve game-related info"
  - Line 169: `resolveGameInfo()` function definition

- [ ] `src/http-api-routes.ts` (2 references - will be removed)
  - Line 27: `import './services/game/leaderboard-api.js'`
  - Line 39: `import './services/game/leaderboard-api.js'`

- [ ] `src/services/redis.ts` (1 reference)
  - Line 4: Comment "Provides Redis-based persistence for game data"

#### Test Files
- [ ] `tests/unit/markdown-structure-json-string.test.ts`
  - Line 106: Path reference to `docs/knowledge-mining-game.md`

### Redis Keys to Update (or Remove)

- [ ] `game:leaderboard` → Remove (replaced by Prometheus metrics)
- [ ] `game:implementationBonusTotals` → `stats:implementationBonusTotals` (if keeping Redis)
- [ ] `game:rareSuccessCounts` → `stats:rareSuccessCounts` (if keeping Redis)

### Type/Interface Renames

- [ ] `GameStats` → `ModelStats`
- [ ] `GameLeaderboard` → `ModelLeaderboard` (or remove)
- [ ] `GemScore` → `QualityScore` or `KnowledgeScore`
- [ ] `Achievement` → Remove (not needed)

### Function/Method Renames

- [ ] `KnowledgeGameService` class → `ModelStatsService`
- [ ] `knowledgeGame` instance → `modelStats`
- [ ] `getLeaderboard()` → Remove
- [ ] `getAgentStats()` → `getModelStats()`
- [ ] `processGemDiscovery()` → `processContribution()` or `processKnowledgeContribution()`
- [ ] `calculateGemScore()` → `calculateQualityScore()`
- [ ] `calculateStepGemMetadata()` → `calculateStepQualityMetadata()`
- [ ] `resolveGameInfo()` → `resolveStatsInfo()` or `resolveQualityInfo()`

### Quality Label Updates

- [ ] `legendary` → `excellent` (all occurrences)
- [ ] `rare` → `high` (all occurrences)
- [ ] `quality` → `standard` (all occurrences)
- [ ] `common` → `basic` (all occurrences)

### "Gem" Terminology Removal

#### Field Names in Qdrant Payloads
- [ ] `gem_metadata` → `quality_metadata` or `stats_metadata`
- [ ] `step_gem_potential` → `step_quality_score` or `step_potential`
- [ ] `healer_gems_distributed` → `healer_contributions_distributed`

#### Function Names
- [ ] `calculateStepGemMetadata()` → `calculateStepQualityMetadata()`
- [ ] `updateGemMetadata()` → `updateQualityMetadata()`
- [ ] `calculateProtocolGemMetadata()` → `calculateProtocolQualityMetadata()`

#### Variable Names
- [ ] `gem` variables → `contribution` or `knowledge`
- [ ] `gemScore` → `qualityScore`
- [ ] `gemMetadata` → `qualityMetadata`
- [ ] `updatedGemMetadata` → `updatedQualityMetadata`
- [ ] `newGemMetadata` → `newQualityMetadata`
- [ ] `stepGem` → `stepQuality` or `stepStats`

#### Files with "Gem" References
- [ ] `src/resources/memory-resource.ts` (6 references)
  - Line 166: Comment "from gem_metadata"
  - Line 177: Comment "Fetch gem metadata"
  - Line 180: `gem_metadata` field access
  - Line 181: `step_gem_potential` field access
  - Line 188: Comment "step gem metadata unavailable"
  - Line 197: `gem_metadata` field access

- [ ] `src/tools/kairos_attest.ts` (8 references)
  - Line 108: Comment "Recalculate gem metadata"
  - Line 109: Comment "boost gem potential"
  - Line 113: Comment "Calculate new gem metadata"
  - Line 114: `calculateStepGemMetadata`
  - Line 120: Comment "boost gem potential"
  - Line 123: Comment "Update gem metadata"
  - Line 124: `updateGemMetadata`
  - Line 125-127: `step_gem_potential`, `step_quality`, `motivational_text`
  - Line 130: Comment "Updated gem metadata"

- [ ] `src/services/qdrant/service.ts` (1 reference)
  - Line 92-93: `updateGemMetadata()` method

- [ ] `src/services/qdrant/quality.ts` (1 reference)
  - `updateGemMetadata()` function definition

- [ ] `src/services/qdrant/resources.ts` (3 references)
  - Line 83: `gem_metadata` field initialization
  - Line 84: `step_gem_potential` default value
  - Line 115: `gem_metadata` field access

- [ ] `src/services/qdrant/memory-updates.ts` (4 references)
  - Line 80: `gem_metadata` variable
  - Line 81: `shouldRecalculateGem` variable
  - Line 82: `shouldRecalculateGem` usage
  - Line 84: `calculateStepGemMetadata`
  - Line 93: `gem_metadata` field assignment

- [ ] `src/services/qdrant/memory-store.ts` (1 reference)
  - Line 81: `healer_gems_distributed` field

- [ ] `src/services/game/protocol.ts` (2 references)
  - Line 2: Comment "Protocol-level gem metadata"
  - Line 5: Comment "step gem metadata"
  - Line 10: `calculateProtocolGemMetadata` function name
  - Line 30: `stepGem` variable

### Comments to Update

- [ ] All "Knowledge Mining Game" references
- [ ] All "game" references in comments
- [ ] All "gem" references in comments
- [ ] File headers mentioning "Game"
- [ ] All motivational/hype language (emojis, excited phrases)

---

## Migration Strategy

### Step 1: Add Metrics (Non-Breaking)

1. Implement metrics infrastructure
2. Add instrumentation alongside existing code
3. Deploy and verify metrics work
4. Keep existing "game" service running

### Step 2: Remove Leaderboard (Breaking)

1. Remove leaderboard routes
2. Remove leaderboard HTML/CSS/JS
3. Update health check endpoints
4. Deploy and verify

### Step 3: Refactor Game Service (Breaking)

1. Rename `game/` → `stats/`
2. Remove "game" terminology
3. Remove "gem" terminology
4. Update quality labels
5. Remove motivation/hype
6. Expose as Prometheus metrics
7. Update all imports

### Step 4: Clean Up (Non-Breaking)

1. Remove unused files
2. Update documentation
3. Remove archived game docs (or update)

---

## Prometheus Best Practices

### 1. Metric Naming

✅ **Good:**
- `kairos_mcp_tool_calls_total`
- `kairos_memory_store_duration_seconds`
- `kairos_model_contributions_total`

❌ **Bad:**
- `tool_calls` (missing prefix)
- `memory_store_time` (should be `duration_seconds`)
- `contributions` (should have `_total` suffix for counters)

### 2. Label Cardinality

✅ **Good:**
- Low cardinality labels: `tool`, `status`, `quality`
- Fixed set of values

❌ **Bad:**
- High cardinality: `memory_id` (use only for specific metrics where needed)
- User IDs, request IDs as labels

**Exception:** `memory_id` is acceptable for implementation metrics because:
- Limited to active memories being implemented
- Provides valuable per-memory insights
- Can be filtered/aggregated in Prometheus queries

### 3. Histogram Buckets

**Recommended buckets for durations:**
```typescript
buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
```

**For quality scores:**
```typescript
buckets: [0, 5, 10, 15, 20, 25, 30, 35, 40] // 0-40 point scale
```

### 4. Counter vs Gauge

- **Counter**: Use for cumulative values (total requests, total contributions)
- **Gauge**: Use for current state (active connections, current queue size)

### 5. Documentation

Each metric should have:
- Clear `help` text
- Documented label values
- Unit specification in name or help

---

## Example Prometheus Queries

### Agent Performance

```promql
# Total contributions by agent (per tenant)
sum by (agent_id, tenant_id) (kairos_agent_contributions_total)

# Success rate by agent
sum by (agent_id, tenant_id) (kairos_agent_implementation_successes_total) 
/ 
sum by (agent_id, tenant_id) (kairos_agent_implementation_attempts_total)

# Quality distribution per tenant
sum by (quality, tenant_id) (kairos_agent_contributions_total)

# Cross-tenant agent comparison (if needed)
sum by (agent_id) (kairos_agent_contributions_total)
```

### MCP Tool Performance

```promql
# Tool call rate
rate(kairos_mcp_tool_calls_total[5m])

# Tool error rate
rate(kairos_mcp_tool_errors_total[5m])

# P95 latency by tool
histogram_quantile(0.95, 
  rate(kairos_mcp_tool_duration_seconds_bucket[5m])
)
```

### Memory Operations

```promql
# Store rate by quality
rate(kairos_memory_store_total[5m])

# Average search duration
rate(kairos_memory_search_duration_seconds_sum[5m]) 
/ 
rate(kairos_memory_search_duration_seconds_count[5m])
```

### System Health

```promql
# Uptime
kairos_system_uptime_seconds

# Memory usage
kairos_system_memory_usage_bytes{type="heapUsed"}

# Error rate
rate(kairos_mcp_tool_errors_total[5m]) 
+ 
rate(kairos_qdrant_connection_errors_total[5m])
```

---

## Open Questions

1. **Redis persistence**: Should we keep Redis for any business counters, or go fully in-memory?
   - **Recommendation**: In-memory only. If needed later, can add Redis-backed gauges.

2. **Metrics retention**: Should we implement any local metrics storage, or rely entirely on Prometheus?
   - **Recommendation**: Rely on Prometheus. It's designed for this.

3. **Custom metrics**: Should we expose any custom business metrics beyond standard observability?
   - **Recommendation**: Start with standard observability. Add custom metrics as needed.

4. **Metrics aggregation**: Should we pre-aggregate any metrics, or let Prometheus handle it?
   - **Recommendation**: Let Prometheus handle aggregation. Expose raw metrics.

---

## Next Steps

1. **Review this document** - Ensure all metrics are appropriate
2. **Finalize metric list** - Add/remove metrics as needed
3. **Approve implementation plan** - Confirm approach
4. **Begin Phase 1** - Infrastructure setup
5. **Iterate** - Implement phase by phase

---

## References

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [prom-client Documentation](https://github.com/siimon/prom-client)
- [Prometheus Metric Types](https://prometheus.io/docs/concepts/metric_types/)
- [PromQL Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)

---

**Document Status:** Work in Progress  
**Last Updated:** [Current Date]  
**Next Review:** [After feedback]

