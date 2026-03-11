/**
 * Unit tests for resolveMaxConcurrentRequests (concurrency limit from env/cgroup).
 * Only node:fs is mocked so pino (via structured-logger) can use real node:os.
 */

import os from 'node:os';

const mockReadFileSync = jest.fn();
jest.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args)
}));

describe('resolveMaxConcurrentRequests', () => {
  let resolveMaxConcurrentRequests: (envValue: number) => number;

  beforeAll(async () => {
    const mod = await import('../../src/utils/concurrency-limit.js');
    resolveMaxConcurrentRequests = mod.resolveMaxConcurrentRequests;
  });

  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  test('positive override returns that value', () => {
    expect(resolveMaxConcurrentRequests(150)).toBe(150);
    expect(resolveMaxConcurrentRequests(1)).toBe(1);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  test('-1 returns Infinity (disabled)', () => {
    expect(resolveMaxConcurrentRequests(-1)).toBe(Infinity);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  test('0 auto-detects when cgroup unavailable (uses os.totalmem)', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('no cgroup');
    });

    const result = resolveMaxConcurrentRequests(0);

    expect(mockReadFileSync).toHaveBeenCalled();
    expect(result).toBeGreaterThanOrEqual(10);
    const maxCpu = typeof os.availableParallelism === 'function'
      ? os.availableParallelism() * 50
      : os.cpus().length * 50;
    expect(result).toBeLessThanOrEqual(maxCpu);
    expect(Number.isFinite(result)).toBe(true);
  });

  test('0 auto-detects from cgroup when memory.max is readable', () => {
    const cgroupLimitBytes = 100 * 1024 * 1024; // 100 MB
    mockReadFileSync.mockReturnValueOnce(String(cgroupLimitBytes));

    const rssSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 20 * 1024 * 1024,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    });

    const result = resolveMaxConcurrentRequests(0);

    rssSpy.mockRestore();

    expect(mockReadFileSync).toHaveBeenCalledWith('/sys/fs/cgroup/memory.max', 'utf8');
    expect(result).toBeGreaterThanOrEqual(10);
    // totalMem=100MB, usable=70-20=50MB, fromMemory=10, limit=max(10, min(10, cpuCap))=10
    expect(result).toBe(10);
  });
});
