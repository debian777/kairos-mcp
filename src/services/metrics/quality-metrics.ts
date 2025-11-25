import { Counter, Histogram } from 'prom-client';
import { register } from './registry.js';


/**
 * Quality Metrics
 * 
 * Tracks knowledge quality scoring, validation, and quality distribution.
 */

export const qualityRetrievals = new Counter({
  name: 'kairos_quality_retrievals_total',
  help: 'Total number of quality metric retrievals',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualitySuccesses = new Counter({
  name: 'kairos_quality_successes_total',
  help: 'Total number of successful quality validations',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualityPartials = new Counter({
  name: 'kairos_quality_partials_total',
  help: 'Total number of partial success validations',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualityFailures = new Counter({
  name: 'kairos_quality_failures_total',
  help: 'Total number of failed quality validations',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});

export const qualityScoreCalculationDuration = new Histogram({
  name: 'kairos_quality_score_calculation_duration_seconds',
  help: 'Quality score calculation duration in seconds',
  labelNames: ['tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

export const qualityScoreDistribution = new Histogram({
  name: 'kairos_quality_score_distribution',
  help: 'Distribution of quality scores by tier',
  labelNames: ['quality_tier', 'tenant_id'],
  buckets: [0, 5, 10, 15, 20, 25, 30, 35, 40],
  registers: [register]
});

export const qualityBonus = new Counter({
  name: 'kairos_quality_bonus_total',
  help: 'Total quality bonus points awarded',
  labelNames: ['agent_id', 'tenant_id'],
  registers: [register]
});


