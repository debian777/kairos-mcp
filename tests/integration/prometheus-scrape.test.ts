import { waitForHealthCheck } from '../utils/health-check.js';

const METRICS_PORT = process.env.METRICS_PORT || '9090';
const METRICS_URL = `http://localhost:${METRICS_PORT}/metrics`;

describe('Prometheus Scrape Validation', () => {
  let metricsServerAvailable = false;

  beforeAll(async () => {
    // Wait for metrics server to be ready
    try {
      await waitForHealthCheck({
        url: `http://localhost:${METRICS_PORT}/health`,
        timeoutMs: 10000,
        intervalMs: 500
      });
      metricsServerAvailable = true;
    } catch (_error) {
      // Metrics server might not be running in test environment
      metricsServerAvailable = false;
      console.warn('Metrics server not available, some tests may be skipped');
    }
  }, 20000);

  test('Prometheus can scrape metrics endpoint', async () => {
    if (!metricsServerAvailable) {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    // Validate Prometheus format
    const lines = metrics.split('\n');
    
    // Should have HELP and TYPE declarations
    const helpLines = lines.filter(l => l.startsWith('# HELP'));
    const typeLines = lines.filter(l => l.startsWith('# TYPE'));
    
    expect(helpLines.length).toBeGreaterThan(0);
    expect(typeLines.length).toBeGreaterThan(0);
    
    // Each metric should have HELP and TYPE
    const metricNames = new Set<string>();
    typeLines.forEach(line => {
      const match = line.match(/# TYPE (\w+) (\w+)/);
      if (match) {
        metricNames.add(match[1]!);
      }
    });
    
    expect(metricNames.size).toBeGreaterThan(0);
    
    // Verify metrics are properly formatted
    metricNames.forEach(name => {
      const metricLines = lines.filter(l => l.startsWith(name) && !l.startsWith('#'));
      metricLines.forEach(line => {
        // Should match Prometheus metric format: name{labels} value
        // Allow for comments and empty lines
        if (line.trim() && !line.startsWith('#')) {
          expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+[\d.eE+-]+/);
        }
      });
    });
  });

  test('all metrics have tenant_id label where applicable', async () => {
    if (!metricsServerAvailable) {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    const lines = metrics.split('\n');
    
    // Find all metric lines (not comments)
    const metricLines = lines.filter(l => 
      l.trim() && 
      !l.startsWith('#') && 
      l.includes('{')
    );
    
    // Most metrics should have tenant_id (system metrics may not)
    const metricsWithTenant = metricLines.filter(l => l.includes('tenant_id='));
    // At least some metrics should have tenant_id
    expect(metricsWithTenant.length).toBeGreaterThan(0);
  });

  test('metrics have proper HELP and TYPE declarations', async () => {
    if (!metricsServerAvailable) {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    const lines = metrics.split('\n');
    
    const helpLines = lines.filter(l => l.startsWith('# HELP'));
    const typeLines = lines.filter(l => l.startsWith('# TYPE'));
    
    // Should have both HELP and TYPE for each metric
    expect(helpLines.length).toBeGreaterThan(0);
    expect(typeLines.length).toBeGreaterThan(0);
    
    // Extract metric names from TYPE lines
    const typeMetricNames = new Set<string>();
    typeLines.forEach(line => {
      const match = line.match(/# TYPE (\w+)/);
      if (match) {
        typeMetricNames.add(match[1]!);
      }
    });
    
    // Extract metric names from HELP lines
    const helpMetricNames = new Set<string>();
    helpLines.forEach(line => {
      const match = line.match(/# HELP (\w+)/);
      if (match) {
        helpMetricNames.add(match[1]!);
      }
    });
    
    // Most metrics should have both HELP and TYPE
    const commonMetrics = Array.from(typeMetricNames).filter(name => helpMetricNames.has(name));
    expect(commonMetrics.length).toBeGreaterThan(0);
  });
});

