import { register } from '../../src/services/metrics/registry.js';
import { getBuildVersion } from '../../src/utils/build-version.js';

describe('Metrics Registry', () => {
  test('registry exists and is configured', () => {
    expect(register).toBeDefined();
    expect(register).toHaveProperty('metrics');
    expect(register).toHaveProperty('contentType');
  });

  test('default labels are set', async () => {
    const metrics = await register.metrics();
    expect(metrics).toBeTruthy();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('kairos_version');
    expect(metrics).toContain('instance');
    expect(metrics).toContain(`kairos_version="${getBuildVersion()}"`);
    expect(metrics).toContain('service="kairos"');
  });

  test('metrics can be retrieved', async () => {
    const metrics = await register.metrics();
    expect(metrics).toBeTruthy();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
  });

  test('metrics format is valid Prometheus format', async () => {
    const metrics = await register.metrics();
    // Should contain HELP and TYPE lines
    expect(metrics).toMatch(/# HELP/);
    expect(metrics).toMatch(/# TYPE/);
    
    // Should have proper Prometheus format
    const lines = metrics.split('\n');
    const helpLines = lines.filter(l => l.startsWith('# HELP'));
    const typeLines = lines.filter(l => l.startsWith('# TYPE'));
    
    expect(helpLines.length).toBeGreaterThan(0);
    expect(typeLines.length).toBeGreaterThan(0);
  });

  test('content type is correct', () => {
    expect(register.contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
  });
});

