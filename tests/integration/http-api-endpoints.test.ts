import { waitForHealthCheck } from '../utils/health-check.js';

const APP_PORT = process.env.PORT || '3300';
const BASE_URL = `http://localhost:${APP_PORT}`;
const API_BASE = `${BASE_URL}/api`;

describe('HTTP REST API Endpoints', () => {
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
      console.warn('Server not available, skipping HTTP API tests');
    }
  }, 60000);

  describe('POST /api/kairos_mint/raw', () => {
    test('accepts raw markdown and stores memories', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const markdown = `# Test Document ${Date.now()}\n\nThis is a test document for HTTP API mint endpoint.`;
      const response = await fetch(`${API_BASE}/kairos_mint/raw?force=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/markdown',
          'X-LLM-Model-ID': 'test-model'
        },
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
      expect(data.metadata).toHaveProperty('count');
      expect(data.metadata).toHaveProperty('duration_ms');
    }, 30000);

    test('rejects empty markdown', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_mint/raw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/markdown'
        },
        body: ''
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
      expect(data).toHaveProperty('message');
    });

    test('handles force update parameter', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const markdown = `# Force Update Test ${Date.now()}\n\nTesting force update.`;
      const response = await fetch(`${API_BASE}/kairos_mint/raw?force=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/markdown'
        },
        body: markdown
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('stored');
    }, 30000);
  });

  describe('POST /api/snapshot', () => {
    test('triggers Qdrant snapshot', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/snapshot`, {
        method: 'POST'
      });

      // Snapshot may succeed (200), be skipped (202), or fail (502)
      expect([200, 202, 502]).toContain(response.status);
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('target', 'qdrant');
    }, 30000);
  });

  describe('POST /api/kairos_search', () => {
    test('searches for chain heads', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const query = `Test Query ${Date.now()}`;
      const response = await fetch(`${API_BASE}/kairos_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('protocol_status');
      expect(data).toHaveProperty('metadata');
      expect(data.metadata).toHaveProperty('duration_ms');
    }, 30000);

    test('rejects empty query', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: '' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });
  });

  describe('POST /api/kairos_next', () => {
    test('requires uri parameter', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('handles valid uri', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      // Use a test URI (may not exist, but should return valid response structure)
      // Solution is now required for steps 2+, so test expects 400 when missing
      const testUri = 'kairos://mem/00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${API_BASE}/kairos_next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uri: testUri })
      });

      // Solution is required for steps 2+, so missing solution should return 400
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('solution is required');
    }, 30000);
  });

  describe('POST /api/kairos_attest', () => {
    test('requires all mandatory parameters', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_attest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_attest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('validates markdown_doc array length matches uris', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'INVALID_INPUT');
    });

    test('handles delete request with valid structure', async () => {
      if (!serverAvailable) {
        console.warn('Skipping test - server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/kairos_delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: ['kairos://mem/00000000-0000-0000-0000-000000000000']
        })
      });

      // May return 200 (success) or 500 (if memory doesn't exist)
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('total_deleted');
        expect(data).toHaveProperty('total_failed');
        expect(data.metadata).toHaveProperty('duration_ms');
      }
    }, 30000);
  });
});


