import { mcpToolCalls, mcpToolDuration } from '../../src/services/metrics/mcp-metrics.js';
import { register } from '../../src/services/metrics/registry.js';

describe('Metrics Collection', () => {
  // Note: We don't reset metrics between tests as prom-client Registry
  // doesn't provide a reset method. Tests check for presence/format instead.

  test('can increment counter', async () => {
    mcpToolCalls.inc({ 
      tool: 'kairos_mint', 
      status: 'success',
      tenant_id: 'test-tenant' 
    });
    
    // Verify metric was incremented by checking metrics output
    const metrics = await register.metrics();
    expect(metrics).toContain('kairos_mcp_tool_calls_total');
    expect(metrics).toMatch(/kairos_mcp_tool_calls_total\{[^}]*tool="kairos_mint"[^}]*status="success"[^}]*tenant_id="test-tenant"[^}]*\}\s+1/);
  });

  test('can observe histogram', async () => {
    const timer = mcpToolDuration.startTimer({ 
      tool: 'kairos_mint',
      tenant_id: 'test-tenant' 
    });
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    timer({ 
      tool: 'kairos_mint', 
      status: 'success',
      tenant_id: 'test-tenant' 
    });
    
    // Verify histogram was recorded
    const metrics = await register.metrics();
    expect(metrics).toContain('kairos_mcp_tool_duration_seconds');
    expect(metrics).toMatch(/kairos_mcp_tool_duration_seconds_bucket/);
  });

  test('tenant_id is included in metric labels', async () => {
    mcpToolCalls.inc({ 
      tool: 'kairos_begin', 
      status: 'success',
      tenant_id: 'test-tenant-123' 
    });
    
    const metrics = await register.metrics();
    expect(metrics).toContain('tenant_id="test-tenant-123"');
  });

  test('multiple increments accumulate', async () => {
    mcpToolCalls.inc({ 
      tool: 'kairos_mint', 
      status: 'success',
      tenant_id: 'test-tenant' 
    });
    
    mcpToolCalls.inc({ 
      tool: 'kairos_mint', 
      status: 'success',
      tenant_id: 'test-tenant' 
    });
    
    const metrics = await register.metrics();
    const match = metrics.match(/kairos_mcp_tool_calls_total\{[^}]*tool="kairos_mint"[^}]*status="success"[^}]*tenant_id="test-tenant"[^}]*\}\s+(\d+)/);
    expect(match).toBeTruthy();
    if (match) {
      expect(parseInt(match[1]!)).toBeGreaterThanOrEqual(2);
    }
  });
});

