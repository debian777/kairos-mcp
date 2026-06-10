import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { MemoryOidcStateStore } from '../../src/services/oidc-state-store.js';
import type { OidcStateEntry, OidcStateStore } from '../../src/services/oidc-state-store.js';

/**
 * Unit tests for the OIDC state store.
 *
 * Tests the MemoryOidcStateStore directly (the in-memory fallback used when
 * REDIS_URL is not configured). The Redis-backed implementation delegates to
 * the shared keyValueStore with native TTL, so its correctness depends on
 * Redis SETEX/GET/DEL — tested via the existing redis integration tests.
 *
 * Covers:
 * - State stored then consumed once (one-time use).
 * - Second consume returns undefined (replay protection).
 * - Expired entries are rejected.
 * - Unknown state returns undefined.
 * - Backend label is correct.
 */

describe('MemoryOidcStateStore', () => {
  let store: OidcStateStore;

  beforeEach(() => {
    store = new MemoryOidcStateStore();
  });

  afterEach(() => {
    // MemoryOidcStateStore starts a sweep timer; allow GC.
    store = null as unknown as OidcStateStore;
  });

  it('reports memory backend', () => {
    expect(store.backend).toBe('memory');
  });

  it('stores and consumes OIDC state exactly once', async () => {
    const entry: OidcStateEntry = { codeVerifier: 'test-verifier-abc', createdAt: Date.now() };
    await store.set('state-token-1', entry);

    const consumed = await store.consume('state-token-1');
    expect(consumed).toEqual(entry);
  });

  it('returns undefined on second consume (one-time use)', async () => {
    const entry: OidcStateEntry = { codeVerifier: 'verifier-once', createdAt: Date.now() };
    await store.set('state-once', entry);

    const first = await store.consume('state-once');
    expect(first).toBeDefined();

    const second = await store.consume('state-once');
    expect(second).toBeUndefined();
  });

  it('returns undefined for unknown state token', async () => {
    const result = await store.consume('nonexistent-state');
    expect(result).toBeUndefined();
  });

  it('rejects expired entries', async () => {
    // Use a real Date.now() spy to simulate expiry without waiting 10 minutes.
    const realDateNow = Date.now;
    const startTime = realDateNow();
    let mockTime = startTime;
    globalThis.Date.now = () => mockTime;

    try {
      const entry: OidcStateEntry = { codeVerifier: 'expiring-verifier', createdAt: mockTime };
      await store.set('state-expire', entry);

      // Immediately consume — should succeed.
      const fresh = await store.consume('state-expire');
      expect(fresh).toEqual(entry);

      // Re-store for expiry test.
      const entry2: OidcStateEntry = { codeVerifier: 'expiring-verifier-2', createdAt: mockTime };
      await store.set('state-expire-2', entry2);

      // Advance time past the 10-minute TTL (600 seconds).
      mockTime = startTime + 601_000;

      const expired = await store.consume('state-expire-2');
      expect(expired).toBeUndefined();
    } finally {
      globalThis.Date.now = realDateNow;
    }
  });

  it('handles multiple concurrent state entries independently', async () => {
    const entryA: OidcStateEntry = { codeVerifier: 'verifier-a', createdAt: Date.now() };
    const entryB: OidcStateEntry = { codeVerifier: 'verifier-b', createdAt: Date.now() };

    await store.set('state-a', entryA);
    await store.set('state-b', entryB);

    // Consuming A does not affect B.
    const consumedA = await store.consume('state-a');
    expect(consumedA).toEqual(entryA);

    const consumedB = await store.consume('state-b');
    expect(consumedB).toEqual(entryB);

    // Both are now consumed.
    expect(await store.consume('state-a')).toBeUndefined();
    expect(await store.consume('state-b')).toBeUndefined();
  });
});
