/**
 * MCP Apps discovery: `listOfferingsForUI` is handled in http-mcp-handler (not SDK).
 */
import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getAuthHeaders } from '../utils/auth-headers.js';
import {
  KAIROS_FORWARD_UI_SKYBRIDGE_URI,
  KAIROS_FORWARD_UI_URI,
  KAIROS_SPACES_UI_SKYBRIDGE_URI,
  MCP_APP_HTML_MIME_TYPE,
  SKYBRIDGE_HTML_MIME_TYPE
} from '../../src/mcp-apps/kairos-ui-constants.js';

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

  test('returns spaces and forward tools plus ui:// resources and embedded prompts', async () => {
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
    expect(Array.isArray(body.result?.prompts)).toBe(true);
    expect(Array.isArray(body.result?.resources)).toBe(true);

    const tools = body.result!.tools as Array<{ name?: string; _meta?: { ui?: { resourceUri?: string } } }>;
    const spaces = tools.find((t) => t.name === 'spaces');
    expect(spaces).toBeDefined();
    expect(spaces?._meta?.ui?.resourceUri).toBe('ui://kairos/spaces-result');

    const forwardTool = tools.find((t) => t.name === 'forward');
    expect(forwardTool).toBeDefined();
    expect(forwardTool?._meta?.ui?.resourceUri).toBe(KAIROS_FORWARD_UI_URI);

    const prompts = body.result!.prompts as Array<{ name?: string; title?: string; description?: string }>;
    const contextualPrompt = prompts.find((p) => p.name === 'contextual-prompt');
    expect(contextualPrompt).toBeDefined();
    expect(contextualPrompt?.title).toBe('Contextual Prompt');
    expect(contextualPrompt?.description).toBe('Prompt: Contextual Prompt');

    const resources = body.result!.resources as Array<{ uri?: string; mimeType?: string }>;
    expect(resources.some((r) => r.uri === 'ui://kairos/spaces-result')).toBe(true);
    expect(resources.find((r) => r.uri === 'ui://kairos/spaces-result')?.mimeType).toBe(MCP_APP_HTML_MIME_TYPE);
    expect(resources.some((r) => r.uri === KAIROS_SPACES_UI_SKYBRIDGE_URI)).toBe(true);
    expect(resources.find((r) => r.uri === KAIROS_SPACES_UI_SKYBRIDGE_URI)?.mimeType).toBe(SKYBRIDGE_HTML_MIME_TYPE);
    expect(resources.some((r) => r.uri === KAIROS_FORWARD_UI_URI)).toBe(true);
    expect(resources.find((r) => r.uri === KAIROS_FORWARD_UI_URI)?.mimeType).toBe(MCP_APP_HTML_MIME_TYPE);
    expect(resources.some((r) => r.uri === KAIROS_FORWARD_UI_SKYBRIDGE_URI)).toBe(true);
    expect(resources.find((r) => r.uri === KAIROS_FORWARD_UI_SKYBRIDGE_URI)?.mimeType).toBe(SKYBRIDGE_HTML_MIME_TYPE);
  });
});
