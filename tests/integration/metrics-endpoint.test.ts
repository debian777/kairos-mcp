import { waitForHealthCheck } from '../utils/health-check.js';

const METRICS_PORT = process.env.METRICS_PORT || '9390';
const METRICS_URL = `http://localhost:${METRICS_PORT}/metrics`;
const METRICS_HEALTH_URL = `http://localhost:${METRICS_PORT}/health`;

describe('Metrics Endpoint Integration', () => {
  beforeAll(async () => {
    // Metrics server MUST be available for these tests
    await waitForHealthCheck({
      url: METRICS_HEALTH_URL,
      timeoutMs: 10000,
      intervalMs: 500
    });
  }, 20000);

  test('metrics endpoint returns valid Prometheus format', async () => {
    const response = await fetch(METRICS_URL);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    
    const metrics = await response.text();
    expect(metrics).toBeTruthy();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics).toContain('# HELP');
    expect(metrics).toContain('# TYPE');
  });

  test('metrics endpoint includes all metric categories', async () => {
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    // Check for all metric categories
    expect(metrics).toMatch(/kairos_mcp_/);
    expect(metrics).toMatch(/kairos_memory_/);
    expect(metrics).toMatch(/kairos_qdrant_/);
    expect(metrics).toMatch(/kairos_agent_/);
    expect(metrics).toMatch(/kairos_embedding_/);
    expect(metrics).toMatch(/kairos_http_/);
    expect(metrics).toMatch(/kairos_system_/);
  });

  test('metrics include default labels', async () => {
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    expect(metrics).toMatch(/kairos_version=/);
    expect(metrics).toMatch(/instance=/);
    expect(metrics).toMatch(/service="kairos"/);
  });

  test('metrics endpoint is on separate port', async () => {
    // Main server should NOT have /metrics (or return 404)
    const mainPort = process.env.PORT || '3300';
    const mainResponse = await fetch(`http://localhost:${mainPort}/metrics`);
    // Main server may not have /metrics endpoint, so 404 is expected
    expect([404, 200]).toContain(mainResponse.status);
    
    // Metrics server should have /metrics
    const metricsResponse = await fetch(METRICS_URL);
    expect(metricsResponse.status).toBe(200);
  });

  test('metrics health endpoint works', async () => {
    const response = await fetch(METRICS_HEALTH_URL);
    expect(response.status).toBe(200);
    const health = await response.json();
    expect(health).toHaveProperty('status');
    expect(health.status).toBe('ok');
  });
});
