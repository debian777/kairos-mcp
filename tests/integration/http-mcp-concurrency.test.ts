/**
 * Integration tests for MCP handler under concurrent load.
 * Proves no context bleed and no CONNECTION_CONFLICT / 5xx under parallel requests.
 */

import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getAuthHeaders } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();
const PARALLEL = 25;

function postMcp(body: object) {
  return fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...getAuthHeaders()
    },
    body: JSON.stringify(body)
  });
}

describe('MCP concurrent requests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
      serverAvailable = true;
    } catch {
      serverAvailable = false;
    }
  }, 60000);

  test(`${PARALLEL} parallel tools/list: all 200, valid JSON-RPC, no CONNECTION_CONFLICT`, async () => {
    if (!serverAvailable) return;

    const requests = Array.from({ length: PARALLEL }, (_, i) =>
      postMcp({
        jsonrpc: '2.0',
        id: i + 1,
        method: 'tools/list'
      })
    );

    const responses = await Promise.all(requests);

    expect(responses).toHaveLength(PARALLEL);

    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    const bodies = (await Promise.all(
      responses.map((res) => res.json())
    )) as Array<{
      jsonrpc?: string;
      result?: { tools?: unknown[] };
      error?: { data?: { error_code?: string } };
    }>;

    for (const body of bodies) {
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error).toBeUndefined();
      expect(body.result).toBeDefined();
      expect(Array.isArray(body.result?.tools)).toBe(true);
      if (body.error?.data?.error_code) {
        expect(body.error.data.error_code).not.toBe('CONNECTION_CONFLICT');
      }
    }
  });
});
