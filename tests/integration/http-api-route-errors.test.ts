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

describe('HTTP route error mapping', () => {
  beforeAll(async () => {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
  }, 60000);

  test('POST /api/forward returns 404 for a non-existent layer uri', async () => {
    expect.hasAssertions();

    const response = await apiFetch(`${API_BASE}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri: 'kairos://layer/00000000-0000-0000-0000-000000000099' })
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'NOT_FOUND');
    expect(data).toHaveProperty('message', 'Layer or adapter not found');
  });

  test('POST /api/forward returns 404 for a non-existent adapter slug uri', async () => {
    expect.hasAssertions();

    const response = await apiFetch(`${API_BASE}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri: 'kairos://adapter/non-existent-slug-for-test' })
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'NOT_FOUND');
    expect(data).toHaveProperty('message', 'Layer or adapter not found');
  });

  test('POST /api/reward returns 404 for a non-existent layer uri', async () => {
    expect.hasAssertions();

    const response = await apiFetch(`${API_BASE}/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uri: 'kairos://layer/00000000-0000-0000-0000-000000000099',
        outcome: 'success',
        feedback: 'test'
      })
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'MEMORY_NOT_FOUND');
    expect(String(data.message ?? '')).toMatch(/not found/i);
  });
});
