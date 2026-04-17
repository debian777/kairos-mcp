import { API_BASE, apiFetch, ensureApiHealth } from './http-api-test-helpers.js';

describe('HTTP REST API Activate Endpoint', () => {
  beforeAll(async () => {
    await ensureApiHealth();
  }, 60000);

  describe('POST /api/activate', () => {
    test('searches for adapter entry layers', async () => {
      expect.hasAssertions();
      const query = `Test Query ${Date.now()}`;
      const response = await apiFetch(`${API_BASE}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      // Activate HTTP response keeps canonical top-level keys; kairos_work_dir is env-dependent.
      const baseSearchKeys = ['choices', 'message', 'must_obey', 'next_action', 'query'];
      expect(Object.keys(data).sort()).toEqual([...(('kairos_work_dir' in data) ? [...baseSearchKeys, 'kairos_work_dir'] : baseSearchKeys)].sort());
      expect(data.must_obey).toBe(true);
      expect(Array.isArray(data.choices)).toBe(true);
      expect(typeof data.message).toBe('string');
      expect(typeof data.next_action).toBe('string');
      expect(data.query).toBe(query);
      if (data.metadata && typeof data.metadata === 'object' && data.metadata !== null && 'duration_ms' in data.metadata) {
        expect(typeof (data.metadata as { duration_ms?: number }).duration_ms).toBe('number');
      }
    }, 30000);

    test('rejects empty query', async () => {
      expect.hasAssertions();
      const response = await apiFetch(`${API_BASE}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('rejects oversized JSON bodies', async () => {
      expect.hasAssertions();
      const response = await apiFetch(`${API_BASE}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'x'.repeat(1_100_000) })
      });

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'PAYLOAD_TOO_LARGE');
    }, 30000);
  });
});
