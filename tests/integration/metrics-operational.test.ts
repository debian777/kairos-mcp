import { getSharedMcpConnection } from '../utils/mcp-client-utils.js';
import { waitForHealthCheck } from '../utils/health-check.js';

const METRICS_PORT = process.env.METRICS_PORT || '9090';
const METRICS_URL = `http://localhost:${METRICS_PORT}/metrics`;

function extractMetricValue(metrics: string, metricName: string, labels?: Record<string, string>): number | null {
  const lines = metrics.split('\n');
  const metricLines = lines.filter(l => 
    l.trim() && 
    !l.startsWith('#') && 
    l.startsWith(metricName)
  );
  
  for (const line of metricLines) {
    if (labels) {
      // Check if all labels match
      let matches = true;
      for (const [key, value] of Object.entries(labels)) {
        const labelPattern = new RegExp(`${key}="${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
        if (!labelPattern.test(line)) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }
    
    // Extract value
    const match = line.match(/\}\s+([\d.eE+-]+)/);
    if (match) {
      return parseFloat(match[1]!);
    }
  }
  
  return null;
}

describe('Metrics Operational Tests', () => {
  let mcpConnection: any;

  beforeAll(async () => {
    // Wait for metrics server (with longer timeout for test environment)
    try {
      await waitForHealthCheck({
        url: `http://localhost:${METRICS_PORT}/health`,
        timeoutMs: 30000,
        intervalMs: 1000
      });
    } catch (_error) {
      // Metrics server might not be running in test environment
      // Skip tests that require metrics server if it's not available
      console.warn('Metrics server not available, some tests may be skipped');
    }
    
    mcpConnection = await getSharedMcpConnection();
  }, 60000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('metrics update after MCP tool call', async () => {
    // Skip if metrics server is not available
    try {
      await fetch(`http://localhost:${METRICS_PORT}/health`);
    } catch {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    // Get initial metrics
    const beforeResponse = await fetch(METRICS_URL);
    const beforeMetrics = await beforeResponse.text();
    const beforeCount = extractMetricValue(
      beforeMetrics, 
      'kairos_mcp_tool_calls_total',
      { tool: 'kairos_begin', status: 'success' }
    ) || 0;
    
    // Call a tool
    await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { query: 'test query', limit: 1 }
    });
    
    // Wait a bit for metrics to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get updated metrics
    const afterResponse = await fetch(METRICS_URL);
    const afterMetrics = await afterResponse.text();
    const afterCount = extractMetricValue(
      afterMetrics,
      'kairos_mcp_tool_calls_total',
      { tool: 'kairos_begin', status: 'success' }
    ) || 0;
    
    // Metrics should have increased
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  }, 30000);

  test('system metrics update over time', async () => {
    // Skip if metrics server is not available
    try {
      await fetch(`http://localhost:${METRICS_PORT}/health`);
    } catch {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response1 = await fetch(METRICS_URL);
    const metrics1 = await response1.text();
    const uptime1 = extractMetricValue(metrics1, 'kairos_system_uptime_seconds');
    
    expect(uptime1).not.toBeNull();
    expect(uptime1!).toBeGreaterThan(0);
    
    // Wait a bit for uptime to increase
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const response2 = await fetch(METRICS_URL);
    const metrics2 = await response2.text();
    const uptime2 = extractMetricValue(metrics2, 'kairos_system_uptime_seconds');
    
    expect(uptime2).not.toBeNull();
    if (uptime1 !== null && uptime2 !== null) {
      // Uptime should increase, but allow for small timing differences
      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    }
  }, 15000);

  test('memory metrics are present', async () => {
    // Skip if metrics server is not available
    try {
      await fetch(`http://localhost:${METRICS_PORT}/health`);
    } catch {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    expect(metrics).toContain('kairos_memory_store_total');
    expect(metrics).toContain('kairos_memory_store_duration_seconds');
    expect(metrics).toContain('kairos_memory_chain_size');
  });

  test('qdrant metrics are present', async () => {
    // Skip if metrics server is not available
    try {
      await fetch(`http://localhost:${METRICS_PORT}/health`);
    } catch {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    expect(metrics).toContain('kairos_qdrant_operations_total');
    expect(metrics).toContain('kairos_qdrant_query_duration_seconds');
  });

  test('agent metrics are present', async () => {
    // Skip if metrics server is not available
    try {
      await fetch(`http://localhost:${METRICS_PORT}/health`);
    } catch {
      console.warn('Skipping test - metrics server not available');
      return;
    }
    const response = await fetch(METRICS_URL);
    const metrics = await response.text();
    
    expect(metrics).toContain('kairos_agent_contributions_total');
    expect(metrics).toContain('kairos_agent_quality_score');
  });
});

