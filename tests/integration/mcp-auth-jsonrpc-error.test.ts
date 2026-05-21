/**
 * MCP auth: unauthenticated JSON-RPC requests to /mcp must receive a JSON-RPC 2.0
 * error envelope (not a plain JSON 401), so MCP clients can parse structured errors.
 *
 * Skipped when AUTH_ENABLED is false (SIMPLE mode).
 */
import { getTestAuthBaseUrl, serverRequiresAuth } from '../utils/auth-headers.js';
import { setupServerCheck } from './cli-commands-shared.js';
import { JSONRPC_ERR_AUTH_REQUIRED } from '../../src/http/mcp-ui-offerings-auth-jsonrpc.js';

const BASE_URL = getTestAuthBaseUrl();
let serverAvailable = false;

beforeAll(async () => {
  serverAvailable = await setupServerCheck();
}, 60000);

describe('MCP unauthenticated JSON-RPC error envelope', () => {
  test('returns JSON-RPC error envelope for unauthenticated JSON-RPC POST to /mcp', async () => {
    if (!serverAvailable) return;
    if (!serverRequiresAuth()) return;

    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/list',
        params: {}
      })
    });

    expect(res.status).toBe(401);

    // WWW-Authenticate header must still be present
    expect(res.headers.get('www-authenticate')).toBeTruthy();

    const body = (await res.json()) as {
      jsonrpc?: string;
      id?: number | null;
      error?: { code?: number; message?: string; data?: Record<string, unknown> };
    };

    // JSON-RPC 2.0 envelope structure
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(42);
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe(JSONRPC_ERR_AUTH_REQUIRED);
    expect(body.error?.message).toBe('Authentication required');

    // Actionable data for the client
    expect(body.error?.data?.['error']).toBe('unauthorized');
    expect(body.error?.data?.['reauth_required']).toBe(true);
    expect(typeof body.error?.data?.['login_url']).toBe('string');
  });

  test('returns plain JSON 401 for non-JSON-RPC POST to /mcp', async () => {
    if (!serverAvailable) return;
    if (!serverRequiresAuth()) return;

    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ hello: 'world' })
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string; message?: string; login_url?: string };
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Authentication required');
    expect(typeof body.login_url).toBe('string');
  });

  test('echoes null id when JSON-RPC request omits id', async () => {
    if (!serverAvailable) return;
    if (!serverRequiresAuth()) return;

    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {}
      })
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { jsonrpc?: string; id?: unknown; error?: unknown };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBeNull();
  });
});
