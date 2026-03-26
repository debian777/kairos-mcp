import { waitForHealthCheck } from '../utils/health-check.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();
const API_BASE = `${BASE_URL}/api`;
const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? 'kairos';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? '';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRateLimitRetry(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
    });
    if (response.status !== 429 || attempt === attempts) {
      return response;
    }
    lastResponse = response;
    const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? '1');
    await sleep(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000);
  }
  return lastResponse as Response;
}

function qdrantHeaders(): Record<string, string> {
  return QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {};
}

function postMcp(body: object): Promise<Response> {
  return fetchWithRateLimitRetry(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...getAuthHeaders()
    },
    body: JSON.stringify(body)
  });
}

function buildProtocolMarkdown(title: string, slug: string, body: string): string {
  return `---
slug: ${slug}
---

# ${title}

## Activation Patterns
When to run.

## Step 1
${body}

\`\`\`json
{"contract": {"type": "comment", "description": "Minimal"}}
\`\`\`

## Reward Signal
Done.`;
}

function layerIdFromUri(uri: string): string {
  const base = uri.split('?')[0] ?? uri;
  return base.split('/').pop() ?? '';
}

async function setPointSlug(pointId: string, slug: string): Promise<void> {
  const response = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/payload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...qdrantHeaders()
    },
    body: JSON.stringify({
      payload: { slug },
      points: [pointId]
    })
  });
  expect(response.ok).toBe(true);
}

async function trainProtocol(title: string, slug: string, body: string): Promise<string> {
  const trainRes = await fetchWithRateLimitRetry(`${API_BASE}/train/raw?force=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown', 'X-LLM-Model-ID': 'test-model' },
    body: buildProtocolMarkdown(title, slug, body)
  });
  expect(trainRes.status).toBe(200);
  const data = await trainRes.json() as { items?: Array<{ uri?: string }> };
  const headUri = data.items?.[0]?.uri;
  expect(typeof headUri).toBe('string');
  return layerIdFromUri(headUri as string);
}

describe('MCP forward slug error guidance', () => {
  beforeAll(async () => {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
  }, 60000);

  test('returns actionable guidance for an ambiguous adapter slug URI', async () => {
    expect.hasAssertions();

    const targetSlug = `forward-mcp-ambiguous-${Date.now()}`;
    const secondSlug = `${targetSlug}-second`;
    const firstPointId = await trainProtocol(`Forward MCP Ambiguous A ${Date.now()}`, targetSlug, 'Ambiguous MCP branch A.');
    const secondPointId = await trainProtocol(`Forward MCP Ambiguous B ${Date.now()}`, secondSlug, 'Ambiguous MCP branch B.');
    expect(secondPointId).not.toBe(firstPointId);
    await setPointSlug(secondPointId, targetSlug);

    const response = await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'forward',
        arguments: { uri: `kairos://adapter/${targetSlug}` }
      }
    });

    const body = await response.json() as {
      jsonrpc?: string;
      result?: {
        isError?: boolean;
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      };
      id?: number | null;
    };

    const errorText = body.result?.content?.[0]?.text;
    expect(typeof errorText).toBe('string');
    const errorPayload = JSON.parse(errorText as string) as {
      error?: string;
      error_code?: string;
      message?: string;
      next_action?: string;
      must_obey?: boolean;
      key?: string;
      adapter_count?: number;
    };

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result?.isError).toBe(true);
    expect(errorPayload.message).toMatch(/matches more than one protocol/i);
    expect(errorPayload.error).toBe('PROTOCOL_KEY_AMBIGUOUS');
    expect(errorPayload.error_code).toBe('PROTOCOL_KEY_AMBIGUOUS');
    expect(errorPayload.must_obey).toBe(true);
    expect(errorPayload.key).toBe(targetSlug);
    expect(errorPayload.adapter_count).toBe(2);
    expect(typeof errorPayload.next_action).toBe('string');
    expect(errorPayload.next_action).toMatch(/activate/i);
  }, 30000);
});
