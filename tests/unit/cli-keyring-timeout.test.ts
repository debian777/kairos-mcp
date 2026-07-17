/**
 * Regression: withKeyringTimeout must not leak its timeout timer.
 *
 * A leaked 10s timer keeps the Node event loop alive, so any CLI command that
 * completes without process.exit() (e.g. `logout`, `forward`) hangs ~10s before
 * exiting. That previously blew the CLI integration test budgets (PR #621).
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { withKeyringTimeout } from '../../src/cli/keyring.js';

describe('withKeyringTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the resolved value and clears the timer (no dangling timeout)', async () => {
    jest.useFakeTimers();
    const result = await withKeyringTimeout(Promise.resolve('token-value'), null);
    expect(result).toBe('token-value');
    // The whole point of the fix: the race settled, so the timeout timer is gone.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the timer when the underlying promise rejects', async () => {
    jest.useFakeTimers();
    await expect(withKeyringTimeout(Promise.reject(new Error('boom')), null)).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resolves the fallback when the underlying promise never settles', async () => {
    jest.useFakeTimers();
    const never = new Promise<string>(() => {});
    const raced = withKeyringTimeout(never, 'fallback');
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(raced).resolves.toBe('fallback');
    expect(jest.getTimerCount()).toBe(0);
  });
});
