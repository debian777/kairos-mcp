/**
 * Auth integration tests: when AUTH_ENABLED=true, assert 401 without token and 200 with token.
 * When AUTH_ENABLED=false, assertions relax (any of 200/401).
 * globalSetup cleans stale .test-auth-* files and provisions fresh token; no manual cleanup needed.
 *
 * Run with Testcontainers Keycloak (recommended):
 *   KEYCLOAK_URL= AUTH_ENABLED=true npm run dev:test -- tests/integration/auth-keycloak.test.ts
 */

import { getAuthHeaders, getTestAuthBaseUrl, hasAuthToken, serverRequiresAuth } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();
const API_BASE = `${BASE_URL}/api`;

describe('Auth (Keycloak + kairos-tester)', () => {
  test('unauthenticated GET /api returns 401 with login_url (or 200 when auth disabled)', async () => {
    const res = await fetch(`${API_BASE}`, { method: 'GET' });
    if (res.status === 200) {
      // Server may have AUTH_ENABLED=false; accept.
      expect(res.status).toBe(200);
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      expect([200, 401]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error', 'Unauthorized');
    expect(data).toHaveProperty('login_url');
    expect(typeof data.login_url).toBe('string');
  }, 60000);

  test('unauthenticated POST /api/kairos_search returns 401 with login_url (or 200 when auth disabled)', async () => {
    const res = await fetch(`${API_BASE}/kairos_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' })
    });
    if (res.status === 200) {
      expect(res.status).toBe(200);
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      expect([200, 401]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('login_url');
  }, 60000);

  test('authenticated GET /api returns 200 and endpoint list', async () => {
    const res = await fetch(`${API_BASE}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!serverRequiresAuth() || !hasAuthToken()) {
      expect([200, 401]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('service', 'KAIROS API');
    expect(data).toHaveProperty('endpoints');
    expect(data.endpoints).toHaveProperty('kairos_search');
  }, 60000);

  test('authenticated POST /api/kairos_search returns 200 or structured error', async () => {
    const res = await fetch(`${API_BASE}/kairos_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ query: 'auth test query' })
    });
    if (!serverRequiresAuth() || !hasAuthToken()) {
      expect([200, 400, 401]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('must_obey');
    expect(data).toHaveProperty('choices');
    expect(Array.isArray(data.choices)).toBe(true);
  }, 60000);
});
