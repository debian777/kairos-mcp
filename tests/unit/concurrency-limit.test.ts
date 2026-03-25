/**
 * Unit tests for resolveMaxConcurrentRequests (concurrency limit from env/cgroup).
 * Cgroup paths are exercised via setCgroupReadFileSyncForTests — Jest ESM cannot reliably
 * mock `node:fs` for statically imported bindings in the SUT.
 */

import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import os from 'node:os';

type ReadFileSyncFn = typeof import('node:fs').readFileSync;

describe('resolveMaxConcurrentRequests', () => {
  let resolveMaxConcurrentRequests: (envValue: number) => number;
  let setCgroupReadFileSyncForTests: (fn: ReadFileSyncFn | null) => void;

  beforeAll(async () => {
    const mod = await import('../../src/utils/concurrency-limit.js');
    resolveMaxConcurrentRequests = mod.resolveMaxConcurrentRequests;
    setCgroupReadFileSyncForTests = mod.setCgroupReadFileSyncForTests;
  });

  afterEach(() => {
    setCgroupReadFileSyncForTests(null);
  });

  test('positive override returns that value', () => {
    expect(resolveMaxConcurrentRequests(150)).toBe(150);
    expect(resolveMaxConcurrentRequests(1)).toBe(1);
  });

  test('-1 returns Infinity (disabled)', () => {
    expect(resolveMaxConcurrentRequests(-1)).toBe(Infinity);
  });

  test('0 auto-detects when cgroup unavailable (uses os.totalmem)', () => {
    const mockRead = jest.fn().mockImplementation(() => {
      throw new Error('no cgroup');
    });
    setCgroupReadFileSyncForTests(mockRead);

    const result = resolveMaxConcurrentRequests(0);

    expect(mockRead).toHaveBeenCalled();
    expect(result).toBeGreaterThanOrEqual(10);
    const maxCpu = typeof os.availableParallelism === 'function'
      ? os.availableParallelism() * 50
      : os.cpus().length * 50;
    expect(result).toBeLessThanOrEqual(maxCpu);
    expect(Number.isFinite(result)).toBe(true);
  });

  test('0 auto-detects from cgroup when memory.max is readable', () => {
    const cgroupLimitBytes = 100 * 1024 * 1024; // 100 MB
    const mockRead = jest.fn().mockReturnValueOnce(String(cgroupLimitBytes));
    setCgroupReadFileSyncForTests(mockRead);

    const rssSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 20 * 1024 * 1024,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    });

    const result = resolveMaxConcurrentRequests(0);

    rssSpy.mockRestore();

    expect(mockRead).toHaveBeenCalledWith('/sys/fs/cgroup/memory.max', 'utf8');
    expect(result).toBeGreaterThanOrEqual(10);
    // totalMem=100MB, usable=70-20=50MB, fromMemory=10, limit=max(10, min(10, cpuCap))=10
    expect(result).toBe(10);
  });
});
