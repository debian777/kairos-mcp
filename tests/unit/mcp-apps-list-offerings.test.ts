import { buildListOfferingsForUIResult } from '../../src/mcp-apps/list-offerings-for-ui.js';
import {
  KAIROS_FORWARD_UI_SKYBRIDGE_URI,
  KAIROS_FORWARD_UI_URI,
  KAIROS_SPACES_UI_SKYBRIDGE_URI,
  MCP_APP_HTML_MIME_TYPE,
  SKYBRIDGE_HTML_MIME_TYPE
} from '../../src/mcp-apps/kairos-ui-constants.js';

describe('buildListOfferingsForUIResult', () => {
  test('includes spaces and forward tools with ui resourceUri and matching resource entries', () => {
    const r = buildListOfferingsForUIResult();
    expect(r.prompts).toHaveLength(1);
    expect(r.tools).toHaveLength(2);
    expect(r.resources).toHaveLength(4);

    const contextualPrompt = r.prompts.find((x) => x.name === 'contextual-prompt');
    expect(contextualPrompt).toBeDefined();
    expect(contextualPrompt?.title).toBe('Contextual Prompt');
    expect(contextualPrompt?.description).toBe('Prompt: Contextual Prompt');

    const spacesTool = r.tools.find((x) => (x as { name?: string }).name === 'spaces') as {
      name?: string;
      _meta?: { ui?: { resourceUri?: string } };
    };
    expect(spacesTool?.name).toBe('spaces');
    expect(spacesTool?._meta?.ui?.resourceUri).toBe('ui://kairos/spaces-result');

    const forwardTool = r.tools.find((x) => (x as { name?: string }).name === 'forward') as {
      name?: string;
      _meta?: { ui?: { resourceUri?: string } };
    };
    expect(forwardTool?.name).toBe('forward');
    expect(forwardTool?._meta?.ui?.resourceUri).toBe(KAIROS_FORWARD_UI_URI);

    const resSpaces = r.resources.find((x) => (x as { uri?: string }).uri === 'ui://kairos/spaces-result') as {
      uri?: string;
      mimeType?: string;
    };
    expect(resSpaces?.mimeType).toBe(MCP_APP_HTML_MIME_TYPE);

    const resSpacesSky = r.resources.find(
      (x) => (x as { uri?: string }).uri === KAIROS_SPACES_UI_SKYBRIDGE_URI
    ) as { uri?: string; mimeType?: string };
    expect(resSpacesSky?.mimeType).toBe(SKYBRIDGE_HTML_MIME_TYPE);

    const resForward = r.resources.find((x) => (x as { uri?: string }).uri === KAIROS_FORWARD_UI_URI) as {
      uri?: string;
      mimeType?: string;
    };
    expect(resForward?.mimeType).toBe(MCP_APP_HTML_MIME_TYPE);

    const resForwardSky = r.resources.find(
      (x) => (x as { uri?: string }).uri === KAIROS_FORWARD_UI_SKYBRIDGE_URI
    ) as { uri?: string; mimeType?: string };
    expect(resForwardSky?.mimeType).toBe(SKYBRIDGE_HTML_MIME_TYPE);
  });
});
