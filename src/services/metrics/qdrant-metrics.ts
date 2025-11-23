import { Counter, Histogram, Gauge } from 'prom-client';
import { register } from './registry.js';


/**
 * Qdrant Vector Database Metrics
 * 
 * Tracks Qdrant operations, connection status, and performance.
 */

export const qdrantOperations = new Counter({
  name: 'kairos_qdrant_operations_total',
  help: 'Total number of Qdrant operations',
  labelNames: ['operation', 'status', 'tenant_id'],
  registers: [register]
});

export const qdrantOperationDuration = new Histogram({
  name: 'kairos_qdrant_operation_duration_seconds',
  help: 'Qdrant operation duration in seconds',
  labelNames: ['operation', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const qdrantConnectionErrors = new Counter({
  name: 'kairos_qdrant_connection_errors_total',
  help: 'Total number of Qdrant connection errors',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const qdrantReconnects = new Counter({
  name: 'kairos_qdrant_reconnect_total',
  help: 'Total number of Qdrant reconnection attempts',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const qdrantCollectionSize = new Gauge({
  name: 'kairos_qdrant_collection_size',
  help: 'Total number of points in Qdrant collection',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const qdrantQueryDuration = new Histogram({
  name: 'kairos_qdrant_query_duration_seconds',
  help: 'Qdrant query execution duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const qdrantUpsertDuration = new Histogram({
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

