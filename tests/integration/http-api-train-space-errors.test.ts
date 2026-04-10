import { waitForHealthCheck } from '../utils/health-check.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();
const API_BASE = `${BASE_URL}/api`;

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
  });
}

describe('HTTP train space validation', () => {
  beforeAll(async () => {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
  }, 60000);

  test('POST /api/train/raw rejects invalid space and lists writable spaces', async () => {
    expect.hasAssertions();
    const markdown = `# Invalid Space ${Date.now()}

## Activation Patterns
Run for invalid space checks.

## Step 1
Verify train space validation.

\`\`\`json
{"contract": {"type": "comment", "description": "Minimal"}}
\`\`\`

## Reward Signal
Done.`;

    const response = await apiFetch('/train/raw?force=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/markdown',
        'X-LLM-Model-ID': 'test-model',
        'X-Space': '/nonexistent-space'
      },
      body: markdown
    });

    expect(response.status).toBe(400);
    const data = await response.json() as {
      error?: string;
      available_spaces?: unknown;
    };
    expect(data.error === 'SPACE_NOT_FOUND' || data.error === 'SPACE_READ_ONLY').toBe(true);
    expect(Array.isArray(data.available_spaces)).toBe(true);
    expect((data.available_spaces as unknown[]).every((entry) => typeof entry === 'string')).toBe(true);
    expect((data.available_spaces as unknown[]).length).toBeGreaterThan(0);
  }, 30000);
});
