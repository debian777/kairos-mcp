/**
 * Regression for the macOS "Keyring unavailable" + hang bug (issue #638).
 *
 * Two guarantees:
 *  1. Load-error visibility: when the native binding fails to load, the reason is captured and
 *     surfaced (getKeyringLoadError / getKeyringUnavailableReason) instead of being swallowed.
 *  2. Degradation latch: when a keyring op times out, the keyring is marked unavailable so
 *     subsequent ops short-circuit immediately instead of each re-incurring the 10s timeout —
 *     which is what turned a single stall into the tens-of-seconds CLI hang.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  __setKeyringForTest,
  getKeyringLoadError,
  getKeyringUnavailableReason,
  getToken,
  isKeyringAvailable,
  setToken,
} from '../../src/cli/keyring.js';

afterEach(() => {
  jest.useRealTimers();
});

describe('keyring load-error visibility', () => {
  it('captures and reports the load error when the native binding is unavailable', () => {
    __setKeyringForTest(null, new Error('Cannot find native binding'));

    expect(isKeyringAvailable()).toBe(false);
    expect(getKeyringLoadError()?.message).toContain('Cannot find native binding');
    expect(getKeyringUnavailableReason()).toContain('native keyring binding unavailable');
    expect(getKeyringUnavailableReason()).toContain('Cannot find native binding');
  });
});

describe('keyring degradation latch', () => {
  it('latches degraded after an op times out and short-circuits later ops', async () => {
    jest.useFakeTimers();
    const never = new Promise<string | null>(() => {});
    const hangingMod = {
      getPassword: () => never,
      setPassword: () => new Promise<void>(() => {}),
      deletePassword: () => new Promise<boolean>(() => {}),
    };
    __setKeyringForTest(hangingMod as never);

    // Before any op, the module "loaded" so it reports available.
    expect(isKeyringAvailable()).toBe(true);

    // First op hangs; the 10s timeout fires and returns the fallback (null).
    const first = getToken('http://localhost:3300');
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await first).toBeNull();

    // The latch is now set: keyring reports unavailable with a truthful, timeout-specific reason.
    expect(isKeyringAvailable()).toBe(false);
    expect(getKeyringUnavailableReason()).toMatch(/timed out/i);

    // Subsequent ops short-circuit immediately — no new timers, no 10s stall.
    expect(await getToken('http://localhost:3300')).toBeNull();
    expect(await setToken('http://localhost:3300', 'tok')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
