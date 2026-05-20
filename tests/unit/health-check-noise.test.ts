import { beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('waitForHealthCheck', () => {
  beforeEach(() => {
    delete (globalThis as any).__KAIROS_TEST_HEALTH_CHECK_CACHE__;
    jest.useRealTimers();
  });

  test('does not log when healthy immediately', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy' })
    });

    const { waitForHealthCheck } = await import('../utils/health-check.js');
    await waitForHealthCheck({
      url: 'http://localhost:3300/health',
      timeoutMs: 60000,
      intervalMs: 10,
      maxRetries: 2
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('dedupes concurrent calls for the same url', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let resolveResponse: ((value: any) => void) | null = null;

    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockImplementation(() => {
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    });

    const { waitForHealthCheck } = await import('../utils/health-check.js');

    const p1 = waitForHealthCheck({
      url: 'http://localhost:3300/health',
      timeoutMs: 60000,
      intervalMs: 10,
      maxRetries: 2
    });
    const p2 = waitForHealthCheck({
      url: 'http://localhost:3300/health',
      timeoutMs: 60000,
      intervalMs: 10,
      maxRetries: 2
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveResponse?.({
      ok: true,
      json: async () => ({ status: 'healthy' })
    });

    await Promise.all([p1, p2]);

    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('logs once if the check takes long enough', async () => {
    delete (globalThis as any).__KAIROS_TEST_HEALTH_CHECK_CACHE__;
    jest.useFakeTimers();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let resolveResponse: ((value: any) => void) | null = null;

    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockImplementation(() => {
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    });

    const { waitForHealthCheck } = await import('../utils/health-check.js');

    const promise = waitForHealthCheck({
      url: 'http://localhost:3300/health',
      timeoutMs: 60000,
      intervalMs: 10,
      maxRetries: 2
    });

    await jest.advanceTimersByTimeAsync(2500);
    expect(logSpy).toHaveBeenCalledTimes(1);

    resolveResponse?.({
      ok: true,
      json: async () => ({ status: 'healthy' })
    });

    await promise;
    expect(logSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
    logSpy.mockRestore();
    jest.useRealTimers();
  });
});

