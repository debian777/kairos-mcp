/**
 * MCP Apps discovery: `listOfferingsForUI` is handled in http-mcp-handler (not SDK).
 */
import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getAuthHeaders } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();

function postMcp(body: object) {
  return fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...getAuthHeaders()
    },
    body: JSON.stringify(body)
  });
}

describe('MCP listOfferingsForUI', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
      serverAvailable = true;
    } catch {
      serverAvailable = false;
    }
  }, 60000);

  test('returns embedded prompts (not empty) while tools/resources stay empty stubs', async () => {
    if (!serverAvailable) return;

    const res = await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'listOfferingsForUI',
      params: {}
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jsonrpc?: string;
      id?: number;
      result?: { tools?: unknown[]; prompts?: unknown[]; resources?: unknown[] };
    };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect(body.result).toBeDefined();
    expect(Array.isArray(body.result?.tools)).toBe(true);
    expect(body.result?.tools).toHaveLength(0);
    expect(Array.isArray(body.result?.resources)).toBe(true);
    expect(body.result?.resources).toHaveLength(0);

    const prompts = body.result!.prompts as Array<{ name?: string; title?: string; description?: string }>;
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThan(0);

    const contextualPrompt = prompts.find((p) => p.name === 'contextual-prompt');
    expect(contextualPrompt).toBeDefined();
    expect(contextualPrompt?.title).toBe('Contextual Prompt');
    expect(contextualPrompt?.description).toBe('Prompt: Contextual Prompt');
  });
});
