import { describe, expect, it } from '@jest/globals';
import { oidcStateStore } from '../../src/services/oidc-state-store.js';
import type { OidcStateEntry } from '../../src/services/oidc-state-store.js';
import { isRedisConfigured } from '../../src/config.js';

/**
 * Unit tests for the unified OIDC state store.
 *
 * The store now always delegates to keyValueStore (Redis when configured,
 * MemoryStore otherwise). Tests verify the interface contract regardless
 * of which backend is active.
 *
 * Functional tests (set/consume) are skipped in unit test context because
 * they require a running Redis instance when isRedisConfigured=true.
 * Integration tests cover the functional behavior with real backends.
 */

describe('oidcStateStore (unified)', () => {
  it('backend label matches isRedisConfigured', () => {
    const expected = isRedisConfigured ? 'redis' : 'memory';
    expect(oidcStateStore.backend).toBe(expected);
  });

  // Functional tests require a running backend (Redis or MemoryStore).
  // When Redis is configured, these tests need a real Redis connection.
  // Integration tests cover the functional behavior with real backends.
  // For unit tests, we skip functional tests when Redis is configured.
  const testFn = isRedisConfigured ? it.skip : it;

  testFn('stores and consumes OIDC state exactly once', async () => {
    const entry: OidcStateEntry = { codeVerifier: 'test-verifier-abc', createdAt: Date.now() };
    await oidcStateStore.set('state-token-1', entry);

    const consumed = await oidcStateStore.consume('state-token-1');
    expect(consumed).toEqual(entry);
  });

  testFn('returns undefined on second consume (one-time use)', async () => {
    const entry: OidcStateEntry = { codeVerifier: 'verifier-once', createdAt: Date.now() };
    await oidcStateStore.set('state-once', entry);

    const first = await oidcStateStore.consume('state-once');
    expect(first).toBeDefined();

    const second = await oidcStateStore.consume('state-once');
    expect(second).toBeUndefined();
  });

  testFn('returns undefined for unknown state token', async () => {
    const result = await oidcStateStore.consume('nonexistent-state-unique-' + Date.now());
    expect(result).toBeUndefined();
  });

  testFn('handles multiple concurrent state entries independently', async () => {
    const entryA: OidcStateEntry = { codeVerifier: 'verifier-a', createdAt: Date.now() };
    const entryB: OidcStateEntry = { codeVerifier: 'verifier-b', createdAt: Date.now() };

    await oidcStateStore.set('state-a-multi', entryA);
    await oidcStateStore.set('state-b-multi', entryB);

    const consumedA = await oidcStateStore.consume('state-a-multi');
    expect(consumedA).toEqual(entryA);

    const consumedB = await oidcStateStore.consume('state-b-multi');
    expect(consumedB).toEqual(entryB);

    expect(await oidcStateStore.consume('state-a-multi')).toBeUndefined();
    expect(await oidcStateStore.consume('state-b-multi')).toBeUndefined();
  });
});
