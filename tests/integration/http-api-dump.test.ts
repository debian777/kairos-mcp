/**
 * Integration tests for POST /api/kairos_dump.
 */

import { waitForHealthCheck } from '../utils/health-check.js';

const APP_PORT = process.env.PORT || '3300';
const BASE_URL = `http://localhost:${APP_PORT}`;
const API_BASE = `${BASE_URL}/api`;

describe('POST /api/kairos_dump', () => {
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
      console.warn('Server not available, skipping HTTP kairos_dump tests');
    }
  }, 60000);

  test('requires uri and rejects empty', async () => {
    if (!serverAvailable) {
      console.warn('Skipping test - server not available');
      return;
    }

    const response = await fetch(`${API_BASE}/kairos_dump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'INVALID_INPUT');
    expect(data.message).toContain('uri');
  });

  test('returns 404 for non-existent memory UUID', async () => {
    if (!serverAvailable) {
      console.warn('Skipping test - server not available');
      return;
    }

    const response = await fetch(`${API_BASE}/kairos_dump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri: 'kairos://mem/00000000-0000-0000-0000-000000000099' })
    });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error', 'NOT_FOUND');
  });

  test('returns markdown_doc for valid URI (mint then dump)', async () => {
    if (!serverAvailable) {
      console.warn('Skipping test - server not available');
      return;
    }

    const markdown = `# Dump HTTP ${Date.now()}\n\n## Step 1\nContent for HTTP dump test.`;
    const mintRes = await fetch(`${API_BASE}/kairos_mint/raw?force=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/markdown' },
      body: markdown
    });
    expect(mintRes.status).toBe(200);
    const mintData = await mintRes.json();
    expect(mintData.items).toBeDefined();
    expect(mintData.items.length).toBeGreaterThanOrEqual(1);
    const uri = mintData.items[0].uri;

    const response = await fetch(`${API_BASE}/kairos_dump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri })
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('markdown_doc');
    expect(typeof data.markdown_doc).toBe('string');
    expect(data.markdown_doc.length).toBeGreaterThan(0);
    expect(data).toHaveProperty('uri', uri);
    expect(data).toHaveProperty('label');
    expect(data).toHaveProperty('metadata');
    expect(data.metadata).toHaveProperty('duration_ms');
  }, 30000);
});
