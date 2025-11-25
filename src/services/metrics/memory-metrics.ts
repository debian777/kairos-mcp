import { Counter, Histogram } from 'prom-client';
import { register } from './registry.js';


/**
 * Memory Operation Metrics
 * 
 * Tracks memory store, retrieve, search, update, and delete operations.
 */

export const memoryStore = new Counter({
  name: 'kairos_memory_store_total',
  help: 'Total number of memories stored',
  labelNames: ['quality', 'tenant_id'],
  registers: [register]
});

export const memoryStoreDuration = new Histogram({
  name: 'kairos_memory_store_duration_seconds',
  help: 'Memory storage operation duration in seconds',
  labelNames: ['quality', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const memoryRetrieve = new Counter({
  name: 'kairos_memory_retrieve_total',
  help: 'Total number of memory retrievals',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memoryRetrieveDuration = new Histogram({
  name: 'kairos_memory_retrieve_duration_seconds',
  help: 'Memory retrieval operation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

export const memorySearch = new Counter({
  name: 'kairos_memory_search_total',
  help: 'Total number of search operations',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memorySearchDuration = new Histogram({
  name: 'kairos_memory_search_duration_seconds',
  help: 'Search operation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const memorySearchResults = new Histogram({
  name: 'kairos_memory_search_results_count',
  help: 'Number of results returned per search',
  labelNames: ['tenant_id'],
  buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register]
});

export const memoryUpdate = new Counter({
  name: 'kairos_memory_update_total',
  help: 'Total number of memory updates',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memoryDelete = new Counter({
  name: 'kairos_memory_delete_total',
  help: 'Total number of memory deletions',
  labelNames: ['tenant_id'],
  registers: [register]
});

export const memoryChainSize = new Histogram({
  name: 'kairos_memory_chain_size',
  help: 'Number of steps in stored memory chains',
  labelNames: ['tenant_id'],
  buckets: [1, 2, 3, 4, 5, 10, 15, 20, 25, 50],
  registers: [register]
});



