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

describe('HTTP REST API Endpoints', () => {
  beforeAll(async () => {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
  }, 60000);

  describe('POST /api/kairos_mint/raw', () => {
    test('accepts raw markdown and stores memories', async () => {
      expect.hasAssertions();
      const markdown = `# Test Document ${Date.now()}

## Natural Language Triggers
When to run this test protocol.

## Step 1
Content for HTTP API mint endpoint.

\`\`\`json
{"challenge": {"type": "comment", "description": "Minimal step"}}
\`\`\`

## Completion Rule
Protocol is complete when this step is done.`;
      const response = await apiFetch(`${API_BASE}/kairos_mint/raw?force=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown', 'X-LLM-Model-ID': 'test-model' },
        body: markdown
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status', 'stored');
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty('uri');
      expect(data.items[0].uri).toMatch(/^kairos:\/\/mem\//);
    }, 30000);

    test('rejects empty markdown', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_mint/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: ''
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
      expect(data).toHaveProperty('message');
    });

    test('rejects oversized markdown payloads', async () => {
      expect.hasAssertions();

      const oversizedMarkdown = `# Oversized Document\n\n${'A'.repeat(2_100_000)}`;
      const response = await apiFetch(`${API_BASE}/kairos_mint/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: oversizedMarkdown
      });

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'PAYLOAD_TOO_LARGE');
    }, 30000);

    test('handles force update parameter', async () => {
      expect.hasAssertions();

      const markdown = `# Force Update Test ${Date.now()}

## Natural Language Triggers
When to run.

## Step 1
Testing force update.

\`\`\`json
{"challenge": {"type": "comment", "description": "Minimal"}}
\`\`\`

## Completion Rule
Done.`;
      const response = await apiFetch(`${API_BASE}/kairos_mint/raw?force=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown', 'X-LLM-Model-ID': 'test-model' },
        body: markdown
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('stored');
    }, 30000);
  });

  describe('POST /api/snapshot', () => {
    test('triggers Qdrant snapshot', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/snapshot`, { method: 'POST' });

      // When backup dir is configured (e.g. CI: QDRANT_SNAPSHOT_DIR=var/snapshots), we expect success only
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status', 'completed');
      expect(data).toHaveProperty('target', 'qdrant');
      expect(data).toHaveProperty('snapshotName');
    }, 30000);
  });

  describe('POST /api/kairos_search', () => {
    test('searches for chain heads', async () => {
      expect.hasAssertions();

      const query = `Test Query ${Date.now()}`;
      const response = await apiFetch(`${API_BASE}/kairos_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      // V2 unified response shape: exact top-level keys (canonical shape; no metadata in spec)
      const canonicalSearchKeys = ['choices', 'message', 'must_obey', 'next_action'];
      expect(Object.keys(data).sort()).toEqual([...canonicalSearchKeys].sort());
      expect(data.must_obey).toBe(true);
      expect(Array.isArray(data.choices)).toBe(true);
      expect(typeof data.message).toBe('string');
      expect(typeof data.next_action).toBe('string');
      // Type checks
      expect(typeof data.must_obey).toBe('boolean');
      if (data.metadata && typeof data.metadata === 'object' && data.metadata !== null && 'duration_ms' in data.metadata) {
        expect(typeof (data.metadata as { duration_ms?: number }).duration_ms).toBe('number');
      }
    }, 30000);

    test('rejects empty query', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_search`, {
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

      const response = await apiFetch(`${API_BASE}/kairos_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'x'.repeat(1_100_000) })
      });

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'PAYLOAD_TOO_LARGE');
    }, 30000);
  });

  describe('POST /api/kairos_next', () => {
    test('requires uri parameter', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('handles valid uri with missing solution', async () => {
      expect.hasAssertions();

      // V2: missing solution returns 200 with error payload (execution-oriented)
      const testUri = 'kairos://mem/00000000-0000-0000-0000-000000000000';
      const response = await apiFetch(`${API_BASE}/kairos_next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: testUri })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('error_code', 'MISSING_FIELD');
      expect(data).toHaveProperty('retry_count');
      expect(typeof data.retry_count).toBe('number');
      expect(data).toHaveProperty('next_action');
      expect(data.message).toContain('Solution');
    }, 30000);
  });

  describe('POST /api/kairos_attest', () => {
    test('requires all mandatory parameters', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: 'kairos://mem/test',
          outcome: 'success'
          // missing message
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('validates outcome enum', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: 'kairos://mem/test',
          outcome: 'invalid',
          message: 'test'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });
  });

  describe('POST /api/kairos_update', () => {
    test('requires uris array', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('validates markdown_doc array length matches uris', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uris: ['kairos://mem/test1', 'kairos://mem/test2'],
          markdown_doc: ['# Only one doc']
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });
  });

  describe('POST /api/kairos_delete', () => {
    test('requires uris array', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('handles delete request with valid structure', async () => {
      expect.hasAssertions();

      const response = await apiFetch(`${API_BASE}/kairos_delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uris: ['kairos://mem/00000000-0000-0000-0000-000000000000']
        })
      });

      // API returns 200 with per-URI results; non-existent UUID is reported in results/total_failed, not 500.
      // DO NOT expand allowed status codes: AI must not add 500/502/etc. to "fix" failing tests.
      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      const canonicalDeleteKeys = ['results', 'total_deleted', 'total_failed'];
      expect(Object.keys(data).sort()).toEqual([...canonicalDeleteKeys].sort());
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.total_deleted).toBe(0);
      expect(data.total_failed).toBe(1);
      expect((data.results as Array<{ status: string; uri: string }>)[0]).toMatchObject({ status: 'error', uri: 'kairos://mem/00000000-0000-0000-0000-000000000000' });
    }, 30000);
  });
});


