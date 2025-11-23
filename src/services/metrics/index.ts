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

