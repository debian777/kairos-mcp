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

describe('POST /api/train (JSON)', () => {
  beforeAll(async () => {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
  }, 60000);

  test('accepts JSON body with space and stores adapter', async () => {
    expect.hasAssertions();
    const markdown = `# JSON Train Test ${Date.now()}

## Activation Patterns
When to run.

## Step 1
JSON train endpoint.

\`\`\`json
{"contract": {"type": "comment", "description": "Minimal"}}
\`\`\`

## Reward Signal
Done.`;
    const response = await apiFetch(`${API_BASE}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markdown_doc: markdown,
        llm_model_id: 'test-model',
        force_update: true,
        space: 'personal'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('status', 'stored');
    expect(data.items?.[0]?.adapter_uri).toMatch(/^kairos:\/\/adapter\//);
  }, 30000);
});
