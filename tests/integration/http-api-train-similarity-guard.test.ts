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

function buildMarkdown(title: string): string {
  return `# ${title}

## Activation Patterns
Run this adapter when the user wants to manage notes in an Obsidian vault via MCP.

## Discover Notes
List relevant notes in the vault and identify the best candidate for the user's request.

\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":20},"required":true}}
\`\`\`

## Read Or Update Note
Read the chosen note, summarize relevant content, and apply the requested change if needed.

\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":20},"required":true}}
\`\`\`

## Reward Signal
Success means the intended vault note was found and the requested read or edit outcome was completed accurately.`;
}

describe('HTTP train similarity guard regression', () => {
  beforeAll(async () => {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
  }, 60000);

  test('POST /api/train/raw accepts unrelated adapter titles without impossible similarity rejection', async () => {
    expect.hasAssertions();
    const title = `Obsidian Vault - Find, Read, Edit, Create Notes via MCP ${Date.now()}`;
    const response = await apiFetch('/train/raw', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/markdown',
        'X-LLM-Model-ID': 'test-model',
        'X-Space': 'personal'
      },
      body: buildMarkdown(title)
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status', 'stored');
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
  }, 30000);
});
