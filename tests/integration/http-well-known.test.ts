/**
 * Integration tests for OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * Validates well-known endpoints and 401 WWW-Authenticate headers per the
 * MCP Authorization specification (2025-11-25).
 *
 * These tests run against the live dev server and do NOT require auth —
 * well-known discovery must be reachable without credentials.
 */

import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, serverRequiresAuth } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();

describe('Protected Resource Metadata (RFC 9728)', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
      serverAvailable = true;
    } catch {
      serverAvailable = false;
      console.warn('Server not available, skipping well-known tests');
    }
  }, 60000);

  function skipIfUnavailable(): boolean {
    if (!serverAvailable) {
      console.warn('Skipping — server not available');
      return true;
    }
    return false;
  }

  describe('GET /.well-known/oauth-protected-resource (root)', () => {
    test('returns 200 with valid JSON structure', async () => {
      if (skipIfUnavailable()) return;
      const res = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);

      const body = await res.json();
      expect(body).toHaveProperty('resource');
      expect(typeof body.resource).toBe('string');
      expect(body.resource).toMatch(/\/mcp$/);

      expect(body).toHaveProperty('authorization_servers');
      expect(Array.isArray(body.authorization_servers)).toBe(true);
      for (const entry of body.authorization_servers) {
        expect(typeof entry).toBe('string');
      }

      expect(body).toHaveProperty('scopes_supported');
      expect(Array.isArray(body.scopes_supported)).toBe(true);
      expect(body.scopes_supported).toContain('openid');

      expect(body).toHaveProperty('bearer_methods_supported');
      expect(body.bearer_methods_supported).toEqual(['header']);

      expect(body).toHaveProperty('resource_name');
      expect(typeof body.resource_name).toBe('string');

      // Required for MCP clients that build the auth URL themselves (e.g. Cursor with redirect_uri=cursor://).
      // If the client merges this into the auth request, Keycloak gets prompt=login and avoids already_logged_in.
      expect(body).toHaveProperty('authorization_request_parameters');
      expect(body.authorization_request_parameters).toEqual({ prompt: 'login' });
    });
  });

  describe('GET /.well-known/oauth-protected-resource/mcp (path-specific)', () => {
    test('returns 200 with same metadata as root', async () => {
      if (skipIfUnavailable()) return;
      const [rootRes, pathRes] = await Promise.all([
        fetch(`${BASE_URL}/.well-known/oauth-protected-resource`),
        fetch(`${BASE_URL}/.well-known/oauth-protected-resource/mcp`)
      ]);
      expect(rootRes.status).toBe(200);
      expect(pathRes.status).toBe(200);

      const rootBody = await rootRes.json();
      const pathBody = await pathRes.json();
      expect(pathBody).toEqual(rootBody);
    });
  });

  describe('401 WWW-Authenticate header', () => {
    test('unauthenticated POST /mcp returns 401 with resource_metadata and scope', async () => {
      if (skipIfUnavailable()) return;
      if (!serverRequiresAuth()) {
        console.warn('Skipping — AUTH_ENABLED is not true');
        return;
      }
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} })
      });
      expect(res.status).toBe(401);

      const wwwAuth = res.headers.get('www-authenticate');
      expect(wwwAuth).toBeTruthy();
      expect(wwwAuth).toContain('Bearer');
      expect(wwwAuth).toMatch(/resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource"/);
      expect(wwwAuth).toMatch(/scope="/);
    });

  });
});
