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

