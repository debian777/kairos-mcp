/**
 * Unit tests for embedding rate-limit retry helpers (pure functions) and the
 * EmbeddingRateLimitError class exported from providers.ts.
 *
 * These tests exercise the retry policy in isolation — no real HTTP calls.
 * postEmbeddingsOpenAI end-to-end retry behavior requires mocking global.fetch
 * and is covered separately.
 */

import { beforeAll, describe, expect, test } from '@jest/globals';

describe('embedding rate-limit helpers', () => {
  let parseRetryAfterMs: (headers: Headers) => number | null;
  let computeBackoffMs: (attempt: number, baseDelayMs: number, maxDelayMs: number) => number;
  let isOpenAiNonRetriableQuota: (data: any) => boolean;
  let isBudgetExceeded: (deadline: number) => boolean;
  let computeDeadline: () => number;
  let EmbeddingRateLimitError: typeof import('../../src/services/embedding/providers.js').EmbeddingRateLimitError;

  beforeAll(async () => {
    const mod = await import('../../src/services/embedding/providers.js');
    parseRetryAfterMs = mod.parseRetryAfterMs;
    computeBackoffMs = mod.computeBackoffMs;
    isOpenAiNonRetriableQuota = mod.isOpenAiNonRetriableQuota;
    isBudgetExceeded = mod.isBudgetExceeded;
    computeDeadline = mod.computeDeadline;
    EmbeddingRateLimitError = mod.EmbeddingRateLimitError;
  });

  describe('parseRetryAfterMs', () => {
    test('returns null when no retry headers are present', () => {
      const headers = new Headers();
      expect(parseRetryAfterMs(headers)).toBeNull();
    });

    test('parses retry-after-ms header (milliseconds)', () => {
      const headers = new Headers({ 'retry-after-ms': '1500' });
      expect(parseRetryAfterMs(headers)).toBe(1500);
    });

    test('parses retry-after integer seconds', () => {
      const headers = new Headers({ 'retry-after': '3' });
      expect(parseRetryAfterMs(headers)).toBe(3000);
    });

    test('parses retry-after HTTP-date (future)', () => {
      const futureDate = new Date(Date.now() + 5000).toUTCString();
      const headers = new Headers({ 'retry-after': futureDate });
      const result = parseRetryAfterMs(headers);
      expect(result).not.toBeNull();
      // Allow 1s tolerance for test execution time
      expect(result!).toBeGreaterThan(3000);
      expect(result!).toBeLessThanOrEqual(5100);
    });

    test('returns null for retry-after date in the past', () => {
      const pastDate = new Date(Date.now() - 10000).toUTCString();
      const headers = new Headers({ 'retry-after': pastDate });
      expect(parseRetryAfterMs(headers)).toBeNull();
    });

    test('returns null for non-numeric retry-after', () => {
      const headers = new Headers({ 'retry-after': 'bogus' });
      expect(parseRetryAfterMs(headers)).toBeNull();
    });

    test('returns null for zero retry-after', () => {
      const headers = new Headers({ 'retry-after': '0' });
      expect(parseRetryAfterMs(headers)).toBeNull();
    });

    test('returns null for negative retry-after-ms', () => {
      const headers = new Headers({ 'retry-after-ms': '-100' });
      expect(parseRetryAfterMs(headers)).toBeNull();
    });

    test('prefers retry-after-ms over retry-after when both present', () => {
      const headers = new Headers({
        'retry-after-ms': '500',
        'retry-after': '10',
      });
      expect(parseRetryAfterMs(headers)).toBe(500);
    });
  });

  describe('computeBackoffMs', () => {
    test('returns value in [0, baseDelayMs * 2^attempt) capped by maxDelayMs', () => {
      // attempt=0, base=100, max=10000 → exp=100 → result in [0, 100)
      for (let i = 0; i < 20; i++) {
        const result = computeBackoffMs(0, 100, 10_000);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(100);
      }
    });

    test('caps exponential growth at maxDelayMs', () => {
      // attempt=10, base=100 → exp=102400, capped at max=500 → result in [0, 500)
      for (let i = 0; i < 20; i++) {
        const result = computeBackoffMs(10, 100, 500);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(500);
      }
    });

    test('attempt=0 with base=500, max=8000 → range [0, 500)', () => {
      const result = computeBackoffMs(0, 500, 8000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(500);
    });

    test('attempt=3 with base=500, max=8000 → exp=4000, range [0, 4000)', () => {
      for (let i = 0; i < 20; i++) {
        const result = computeBackoffMs(3, 500, 8000);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(4000);
      }
    });
  });

  describe('isOpenAiNonRetriableQuota', () => {
    test('returns true when error.code is insufficient_quota', () => {
      expect(isOpenAiNonRetriableQuota({
        error: { code: 'insufficient_quota', message: 'You exceeded your current quota' }
      })).toBe(true);
    });

    test('returns true when error.type is insufficient_quota', () => {
      expect(isOpenAiNonRetriableQuota({
        error: { type: 'insufficient_quota', message: '...' }
      })).toBe(true);
    });

    test('returns false for rate_limit_exceeded code', () => {
      expect(isOpenAiNonRetriableQuota({
        error: { code: 'rate_limit_exceeded', message: 'Rate limit reached' }
      })).toBe(false);
    });

    test('returns false for null/undefined/empty data', () => {
      expect(isOpenAiNonRetriableQuota(null)).toBe(false);
      expect(isOpenAiNonRetriableQuota(undefined)).toBe(false);
      expect(isOpenAiNonRetriableQuota({})).toBe(false);
      expect(isOpenAiNonRetriableQuota({ error: {} })).toBe(false);
    });

    test('returns false for other error codes', () => {
      expect(isOpenAiNonRetriableQuota({
        error: { code: 'invalid_api_key', message: 'Incorrect API key' }
      })).toBe(false);
    });
  });

  describe('EmbeddingRateLimitError', () => {
    test('has correct name, provider, httpStatus, and code', () => {
      const err = new EmbeddingRateLimitError('openai', 429, 'rate limited', 'rate_limit_exceeded');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(EmbeddingRateLimitError);
      expect(err.name).toBe('EmbeddingRateLimitError');
      expect(err.provider).toBe('openai');
      expect(err.httpStatus).toBe(429);
      expect(err.code).toBe('rate_limit_exceeded');
      expect(err.message).toBe('rate limited');
    });

    test('code is undefined when not provided', () => {
      const err = new EmbeddingRateLimitError('tei', 429, 'tei throttled');
      expect(err.code).toBeUndefined();
      expect(err.provider).toBe('tei');
    });

    test('message contains "429" for health check compatibility', () => {
      const err = new EmbeddingRateLimitError('openai', 429, 'OpenAI rate limit (429): too many requests');
      expect(err.message).toContain('429');
    });
  });

  describe('isBudgetExceeded / computeDeadline', () => {
    test('isBudgetExceeded returns true when past deadline', () => {
      expect(isBudgetExceeded(Date.now() - 1)).toBe(true);
      expect(isBudgetExceeded(0)).toBe(true);
    });

    test('isBudgetExceeded returns false when before deadline', () => {
      expect(isBudgetExceeded(Date.now() + 60_000)).toBe(false);
    });

    test('computeDeadline returns a future timestamp', () => {
      const before = Date.now();
      const deadline = computeDeadline();
      const after = Date.now();
      // Deadline should be ~now + 15000ms (default budget)
      expect(deadline).toBeGreaterThan(before);
      expect(deadline).toBeLessThanOrEqual(after + 15_001);
      expect(deadline).toBeGreaterThanOrEqual(before + 14_999);
    });
  });
});
