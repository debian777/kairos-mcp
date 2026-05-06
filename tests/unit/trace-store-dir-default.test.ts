import os from 'node:os';
import path from 'node:path';

describe('KAIROS_TRACE_STORE_DIR default', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env['KAIROS_TRACE_STORE_DIR'];
    if (!process.env['QDRANT_URL']) process.env['QDRANT_URL'] = 'http://localhost:6333';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults under os.tmpdir() when env is unset', async () => {
    const { KAIROS_TRACE_STORE_DIR } = await import('../../src/config.js');
    const expected = path.join(os.tmpdir(), 'kairos', 'traces');
    expect(KAIROS_TRACE_STORE_DIR).toBe(expected);
  });

  it('respects KAIROS_TRACE_STORE_DIR when explicitly set', async () => {
    process.env['KAIROS_TRACE_STORE_DIR'] = '/custom/traces';
    const { KAIROS_TRACE_STORE_DIR } = await import('../../src/config.js');
    expect(KAIROS_TRACE_STORE_DIR).toBe('/custom/traces');
  });
});
