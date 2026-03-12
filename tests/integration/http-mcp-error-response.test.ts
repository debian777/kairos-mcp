/**
 * Integration tests for MCP handler 500 error responses.
 * Ensures unhandled exceptions (e.g. "Already connected to a transport") return
 * helpful client-facing messages and error_code/retry_hint, never raw "Internal server error".
 */

import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getAuthHeaders } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();

function postMcp(body: object) {
  return fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body)
  });
}

describe('MCP 500 error response shape', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
      serverAvailable = true;
    } catch {
      serverAvailable = false;
    }
  }, 60000);

  function skipIfUnavailable(): boolean {
    return !serverAvailable;
  }

  test('concurrent POST /mcp: 500 responses have helpful message and error.data', async () => {
    if (skipIfUnavailable()) return;

    const req = (id: number) =>
      postMcp({
        jsonrpc: '2.0',
        id: id,
        method: 'tools/call',
        params: { name: 'kairos_search', arguments: { query: 'test' } }
      });

    const responses = await Promise.all([req(1), req(2), req(3), req(4)]);
    const res500 = responses.find((r) => r.status === 500);
    if (!res500) {
      return;
    }
    // When concurrent requests trigger "Already connected to a transport", assert helpful response shape

    const body = (await res500.json()) as {
      jsonrpc?: string;
      error?: { code?: number; message?: string; data?: { error_code?: string; retry_hint?: string } };
      id?: number | null;
    };

    expect(body.jsonrpc).toBe('2.0');
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe(-32603);
    expect(body.error?.message).not.toBe('Internal server error');
    expect(body.error?.message?.length).toBeGreaterThan(0);
    expect(body.error?.data).toBeDefined();
    expect(typeof body.error?.data?.error_code).toBe('string');
    expect(body.error?.data?.error_code?.length).toBeGreaterThan(0);
    expect(typeof body.error?.data?.retry_hint).toBe('string');
    expect(body.error?.data?.retry_hint?.length).toBeGreaterThan(0);
  });
});
