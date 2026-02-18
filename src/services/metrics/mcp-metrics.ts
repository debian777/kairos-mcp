import { Counter, Histogram } from 'prom-client';
import { register } from './registry.js';


/**
 * MCP Tool Metrics
 * 
 * Tracks all kairos_* tool invocations, duration, errors, and payload sizes.
 */

export const mcpToolCalls = new Counter({
  name: 'kairos_mcp_tool_calls_total',
  help: 'Total number of MCP tool invocations',
  labelNames: ['tool', 'status', 'tenant_id'],
  registers: [register]
});

export const mcpToolDuration = new Histogram({
  name: 'kairos_mcp_tool_duration_seconds',
  help: 'MCP tool execution duration in seconds',
  labelNames: ['tool', 'status', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const mcpToolErrors = new Counter({
  name: 'kairos_mcp_tool_errors_total',
  help: 'Total number of MCP tool execution errors',
  labelNames: ['tool', 'status', 'tenant_id'],
  registers: [register]
});

export const mcpToolInputSize = new Histogram({
  name: 'kairos_mcp_tool_input_size_bytes',
  help: 'MCP tool input payload size in bytes',
  labelNames: ['tool', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});

export const mcpToolOutputSize = new Histogram({
  name: 'kairos_mcp_tool_output_size_bytes',
  help: 'MCP tool output payload size in bytes',
  labelNames: ['tool', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});

export const mcpToolErrorCodes = new Counter({
  name: 'kairos_mcp_tool_error_codes_total',
  help: 'Error codes returned by MCP tools (e.g., NONCE_MISMATCH, MAX_RETRIES_EXCEEDED)',
  labelNames: ['tool', 'error_code', 'tenant_id'],
  registers: [register]
});

export const mcpToolRetries = new Counter({
  name: 'kairos_mcp_tool_retries_total',
  help: 'Total retry attempts on MCP tool steps',
  labelNames: ['tool', 'tenant_id'],
  registers: [register]
});

export const mcpToolCircuitBreaker = new Counter({
  name: 'kairos_mcp_tool_circuit_breaker_total',
  help: 'Circuit breaker triggers (max retries exceeded, must_obey set to false)',
  labelNames: ['tool', 'tenant_id'],
  registers: [register]
});

/** Incremented when kairos_next quality update (quality_metadata/metrics) fails. */
export const kairosQualityUpdateErrors = new Counter({
  name: 'kairos_quality_update_errors_total',
  help: 'Quality update failures in kairos_next (log-and-continue path)',
  labelNames: ['tenant_id'],
  registers: [register]
});

/** Incremented when mint returns SIMILAR_MEMORY_FOUND (MCP or HTTP). */
export const kairosMintSimilarMemoryFound = new Counter({
  name: 'kairos_mint_similar_memory_found_total',
  help: 'Times mint returned SIMILAR_MEMORY_FOUND (agent must kairos_begin then decide)',
  labelNames: ['transport', 'tenant_id'],
  registers: [register]
});