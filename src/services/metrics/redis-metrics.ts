import { Counter, Histogram, Gauge } from 'prom-client';
import { register } from './registry.js';


/**
 * Redis Metrics
 * 
 * Tracks Redis operations, connection status, and performance.
 * Only created if Redis is used.
 */

export const redisOperations = new Counter({
  name: 'kairos_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status', 'tenant_id'],
  registers: [register]
});

export const redisOperationDuration = new Histogram({
  name: 'kairos_redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

export const redisConnectionStatus = new Gauge({
  name: 'kairos_redis_connection_status',
  help: 'Redis connection status (1=connected, 0=disconnected)',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const redisErrors = new Counter({
  name: 'kairos_redis_errors_total',
  help: 'Total number of Redis errors',
  labelNames: ['error_type', 'tenant_id'],
  registers: [register]
});



