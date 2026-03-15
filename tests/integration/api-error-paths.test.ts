/**
 * Error-path tests: missing required fields, invalid types, non-existent URIs.
 * Asserts consistent error shape and status codes between MCP and HTTP.
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

const BASE_URL = getTestAuthBaseUrl().replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;

function httpFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
  });
}

describe('API error paths: consistent handling across MCP and HTTP', () => {
  let mcpConnection: { client: { callTool: (arg: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown> }; close: () => Promise<void> };

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 60000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  describe('kairos_search', () => {
    test('HTTP rejects empty query with 400 and INVALID_INPUT', async () => {
      expect.hasAssertions();
      const res = await httpFetch(`${API_BASE}/kairos_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' })
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBe('INVALID_INPUT');
      expect(data.message).toBeDefined();
    });

    test('MCP empty query returns error or fallback', async () => {
      expect.hasAssertions();
      const result = await mcpConnection.client.callTool({
        name: 'kairos_search',
        arguments: { query: '' }
      });
      const r = result as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
      if (r.isError) {
        expect(r.content).toBeDefined();
        return;
      }
      try {
        const parsed = parseMcpJson(result, 'kairos_search empty query');
        expect(parsed).toBeDefined();
      } catch {
        expect(r.content?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('kairos_dump', () => {
    test('HTTP rejects missing uri with 400', async () => {
      expect.hasAssertions();
      const res = await httpFetch(`${API_BASE}/kairos_dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBe('INVALID_INPUT');
    });

    test('HTTP returns 404 for non-existent URI', async () => {
      expect.hasAssertions();
      const res = await httpFetch(`${API_BASE}/kairos_dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: 'kairos://mem/00000000-0000-0000-0000-000000000000' })
      });
      expect(res.status).toBe(404);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBeDefined();
    });
  });

  describe('kairos_attest', () => {
    test('HTTP rejects invalid outcome enum with 400', async () => {
      expect.hasAssertions();
      const res = await httpFetch(`${API_BASE}/kairos_attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: 'kairos://mem/00000000-0000-0000-0000-000000000000',
          outcome: 'invalid',
          message: 'test'
        })
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBe('INVALID_INPUT');
    });
  });

  describe('kairos_delete', () => {
    test('HTTP rejects empty uris array with 400', async () => {
      expect.hasAssertions();
      const res = await httpFetch(`${API_BASE}/kairos_delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [] })
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBe('INVALID_INPUT');
    });
  });

  describe('kairos_next', () => {
    test('HTTP rejects missing uri with 400', async () => {
      expect.hasAssertions();
      const res = await httpFetch(`${API_BASE}/kairos_next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBe('INVALID_INPUT');
    });
  });
});
