/**
 * HTTP API tests for POST /api/kairos_run (canonical natural-language entrypoint).
 */
import { waitForHealthCheck } from '../utils/health-check.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();
const API_BASE = `${BASE_URL}/api`;

function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
  });
}

describe('POST /api/kairos_run', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      await waitForHealthCheck({
        url: `${BASE_URL}/health`,
        timeoutMs: 60000,
        intervalMs: 500
      });
      serverAvailable = true;
    } catch (_error) {
      serverAvailable = false;
      console.warn('Server not available, skipping kairos_run API tests');
    }
  }, 60000);

  test('accepts message and returns begin-shaped payload with routing', async () => {
    if (!serverAvailable) {
      console.warn('Skipping test - server not available');
      return;
    }

    const message = `Run workflow test ${Date.now()}`;
    const response = await apiFetch(`${API_BASE}/kairos_run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('must_obey', true);
    expect(data).toHaveProperty('routing');
    expect(data.routing).toHaveProperty('decision');
    expect(['direct_match', 'refine_ambiguous', 'refine_no_match', 'refine_weak_match']).toContain(data.routing.decision);
    expect(data.routing).toHaveProperty('selected_uri');
    expect(data.routing).toHaveProperty('selected_label');
    expect(data.routing).toHaveProperty('selected_role');
    expect(data).toHaveProperty('current_step');
    expect(data).toHaveProperty('challenge');
    expect(data).toHaveProperty('next_action');
    expect(data).toHaveProperty('metadata');
    expect(data.metadata).toHaveProperty('duration_ms');
  }, 30000);

  test('rejects empty message', async () => {
    if (!serverAvailable) {
      console.warn('Skipping test - server not available');
      return;
    }

    const response = await apiFetch(`${API_BASE}/kairos_run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' })
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'INVALID_INPUT');
    expect(data).toHaveProperty('message');
  });
});
