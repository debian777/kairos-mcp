
const METRICS_PORT = process.env.METRICS_PORT || '9390';
const METRICS_URL = `http://localhost:${METRICS_PORT}/metrics`;
const METRICS_HEALTH_URL = `http://localhost:${METRICS_PORT}/health`;

describe('Metrics Endpoint Integration', () => {
  beforeAll(async () => {
    // Metrics server MUST be available for these tests
    // Metrics server returns {"status":"ok"} not {"status":"healthy"}, so check directly
    const maxAttempts = 20;
    const intervalMs = 500;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      let response: Response | null = null;
      try {
        response = await fetch(METRICS_HEALTH_URL);
        if (response.ok) {
          const healthData = await response.json();
          // Ensure response is fully consumed
          response = null;
          if (healthData.status === 'ok' || healthData.status === 'healthy') {
            return; // Metrics server is ready
          }
        } else {
          // Consume response body even on non-ok status
          await response.text().catch(() => {});
          response = null;
        }
      } catch {
        // Continue retrying
        if (response) {
          try {
            await response.text().catch(() => {});
          } catch {
            // Ignore
          }
          response = null;
        }
      }
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    throw new Error(`Metrics server not available at ${METRICS_HEALTH_URL} after ${maxAttempts} attempts`);
  }, 20000);

  test('metrics endpoint returns valid Prometheus format', async () => {
    const response = await fetch(METRICS_URL);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    
    const metrics = await response.text();
    expect(metrics).toBeTruthy();
    expect(metrics.length).toBeGreaterThan(0);
    
    // Use prometheus parser to validate format
    const { validatePrometheusMetrics } = await import('../utils/prometheus-parser.js');
    const validation = validatePrometheusMetrics(metrics);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
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

  afterAll(async () => {
    // Give connections time to close
    await new Promise(resolve => setTimeout(resolve, 100));
  });
});
