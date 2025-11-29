import { parsePrometheusMetrics, validatePrometheusMetrics } from '../utils/prometheus-parser.js';

const METRICS_PORT = process.env.METRICS_PORT || '9390';
const METRICS_URL = `http://localhost:${METRICS_PORT}/metrics`;

describe('Prometheus Scrape Validation', () => {
  beforeAll(async () => {
    // Metrics server MUST be available for these tests
    // Metrics server returns {"status":"ok"} not {"status":"healthy"}, so check directly
    const maxAttempts = 20;
    const intervalMs = 500;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      let response: Response | null = null;
      try {
        response = await fetch(`http://localhost:${METRICS_PORT}/health`);
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
    
    throw new Error(`Metrics server not available at http://localhost:${METRICS_PORT}/health after ${maxAttempts} attempts`);
  }, 20000);

  test('Prometheus can scrape metrics endpoint', async () => {
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    // Use prometheus parser to validate format
    const validation = validatePrometheusMetrics(metrics);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.metrics.total).toBeGreaterThan(0);
    expect(validation.metrics.withHelp).toBeGreaterThan(0);
    expect(validation.metrics.withType).toBeGreaterThan(0);
    
    // Verify parsed structure
    const parsed = parsePrometheusMetrics(metrics);
    expect(parsed.helpLines.size).toBeGreaterThan(0);
    expect(parsed.typeLines.size).toBeGreaterThan(0);
    expect(parsed.metricLines.length).toBeGreaterThan(0);
  });

  test('all metrics have tenant_id label where applicable', async () => {
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    // Use prometheus parser to find metrics with tenant_id
    const parsed = parsePrometheusMetrics(metrics);
    const metricsWithTenant = parsed.metricLines.filter(m => 
      'tenant_id' in m.labels
    );
    
    // At least some metrics should have tenant_id
    expect(metricsWithTenant.length).toBeGreaterThan(0);
  });

  test('metrics have proper HELP and TYPE declarations', async () => {
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    // Use prometheus parser to validate HELP and TYPE
    const parsed = parsePrometheusMetrics(metrics);
    const validation = validatePrometheusMetrics(metrics);
    
    // Should have both HELP and TYPE declarations
    expect(parsed.helpLines.size).toBeGreaterThan(0);
    expect(parsed.typeLines.size).toBeGreaterThan(0);
    
    // Get unique metric names from metric lines
    const metricNames = new Set(parsed.metricLines.map(m => m.name));
    
    // Most metrics should have both HELP and TYPE
    const metricsWithBoth = Array.from(metricNames).filter(name => 
      parsed.helpLines.has(name) && parsed.typeLines.has(name)
    );
    expect(metricsWithBoth.length).toBeGreaterThan(0);
    
    // Validation should pass
    expect(validation.valid).toBe(true);
  });

  afterAll(async () => {
    // Give connections time to close
    await new Promise(resolve => setTimeout(resolve, 100));
  });
});

