/**
 * Load test for MAX_CONCURRENT_MCP_REQUESTS in two modes:
 * 1. At limit: threads = MAX_CONCURRENT_MCP_REQUESTS → all 200, no timeouts.
 * 2. Over limit: threads > MAX_CONCURRENT_MCP_REQUESTS → mix of 200 and 503, no timeouts.
 *
 * Not part of npm run dev:test — run explicitly: npm run test:load
 *
 * Prerequisite: Set MAX_CONCURRENT_MCP_REQUESTS in .env (e.g. 10), restart server
 * (npm run dev:restart), then npm run test:load. Limit is read from .env by both server and test.
 */

import { request } from 'undici';
import { Agent } from 'undici';
import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getAuthHeaders } from '../utils/auth-headers.js';
import { CLIENT_TIMEOUT_MS, timeoutMsFromResponseMs } from '../utils/test-timeouts.js';

const BASE_URL = getTestAuthBaseUrl();
const WARMUP_COUNT = 2;
/** Extra threads beyond limit for the "over limit" case. */
const OVER_LIMIT_EXTRA = 20;

/** Agent that allows many concurrent connections per origin so the server gets a burst. */
const burstAgent = new Agent({ connections: 50, pipelining: 0 });

function postMcp(body: object, timeoutMs?: number): Promise<{ status: number; headers: Headers; json: () => Promise<unknown> }> {
  const url = `${BASE_URL}/mcp`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...getAuthHeaders()
  };
  return request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    dispatcher: burstAgent,
    ...(timeoutMs != null && { bodyTimeout: timeoutMs, headersTimeout: timeoutMs })
  }).then((res) => ({
    status: res.statusCode,
    headers: new Headers(res.headers as Record<string, string>),
    json: () => res.body.json()
  }));
}

/** Payload that triggers kairos_search (embedding + Qdrant) so request holds the slot longer. */
function searchPayload(id: number): object {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: 'kairos_search', arguments: { query: 'load test concurrency' } }
  };
}

async function measureResponseMs(): Promise<number> {
  const start = Date.now();
  await postMcp(searchPayload(0));
  return Date.now() - start;
}

/** Parse MAX_CONCURRENT_MCP_REQUESTS from .env (loaded into process.env). Returns null if unset, 0, or invalid. */
function getLimitFromEnv(): number | null {
  const raw = process.env.MAX_CONCURRENT_MCP_REQUESTS;
  if (raw === undefined || raw === '') return null;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

describe('MCP concurrency limit (load test)', () => {
  let serverAvailable = false;
  let limit: number | null = null;
  let requestTimeoutMs: number = CLIENT_TIMEOUT_MS;

  beforeAll(async () => {
    limit = getLimitFromEnv();
    try {
      await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
      serverAvailable = true;
      if (serverAvailable && limit !== null) {
        const warmupDurations = await Promise.all(
          Array.from({ length: WARMUP_COUNT }, () => measureResponseMs())
        );
        const responseMs = Math.max(...warmupDurations);
        requestTimeoutMs = timeoutMsFromResponseMs(responseMs);
      }
    } catch {
      serverAvailable = false;
    }
  }, CLIENT_TIMEOUT_MS);

  test(
    'at limit: threads = MAX_CONCURRENT_MCP_REQUESTS → all 200, no timeouts',
    async () => {
      if (!serverAvailable) return;
      if (limit === null) {
        return; // skip: set MAX_CONCURRENT_MCP_REQUESTS in .env to run
      }

      const requests = Array.from({ length: limit }, (_, i) =>
        postMcp(searchPayload(i + 1), requestTimeoutMs)
      );
      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(limit);
      const allOk = responses.every((r) => r.status === 200);
      expect(allOk).toBe(true);
    },
    CLIENT_TIMEOUT_MS
  );

  test(
    'over limit: threads > MAX_CONCURRENT_MCP_REQUESTS → 200 and 503, no timeouts',
    async () => {
      if (!serverAvailable) return;
      if (limit === null) {
        return; // skip: set MAX_CONCURRENT_MCP_REQUESTS in .env to run
      }

      const overLimitCount = limit + OVER_LIMIT_EXTRA;
      const requests = Array.from({ length: overLimitCount }, (_, i) =>
        postMcp(searchPayload(limit! + i + 1), requestTimeoutMs)
      );
      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(overLimitCount);

      const ok = responses.filter((r) => r.status === 200).length;
      const overloaded = responses.filter((r) => r.status === 503).length;

      expect(ok).toBeGreaterThanOrEqual(1);
      expect(overloaded).toBeGreaterThanOrEqual(1);

      let seenRetryAfter = false;
      let seenOverloadedBody = false;
      for (const res of responses) {
        if (res.status === 503) {
          if (res.headers.get('Retry-After')) seenRetryAfter = true;
          const body = (await res.json()) as { error?: { data?: { error_code?: string } } };
          if (body.error?.data?.error_code === 'OVERLOADED') seenOverloadedBody = true;
        }
      }
      expect(seenRetryAfter).toBe(true);
      expect(seenOverloadedBody).toBe(true);
    },
    CLIENT_TIMEOUT_MS
  );
});
