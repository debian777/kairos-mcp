/**
 * MCP Apps: resources/read for ui://kairos/spaces-result returns HTML profile mcp-app.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import {
  KAIROS_FORWARD_UI_SKYBRIDGE_URI,
  KAIROS_SPACES_UI_SKYBRIDGE_URI,
  MCP_APP_HTML_MIME_TYPE,
  SKYBRIDGE_HTML_MIME_TYPE
} from '../../src/mcp-apps/kairos-ui-constants.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('MCP UI resource read (spaces widget)', () => {
  let mcpConnection: { client: Client; close: () => Promise<void> } | undefined;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('resources/read ui://kairos/spaces-result returns HTML with Kairos branding', async () => {
    const result = await mcpConnection.client.readResource({ uri: 'ui://kairos/spaces-result' });
    withRawOnFail(result, () => {
      expect(result.contents?.length).toBeGreaterThan(0);
      const c = result.contents![0];
      expect(c.uri).toBe('ui://kairos/spaces-result');
      expect(c.mimeType).toBe(MCP_APP_HTML_MIME_TYPE);
      expect(typeof c.text).toBe('string');
      expect(c.text).toContain('<!DOCTYPE html>');
      expect(c.text).toContain('KAIROS');
      expect(c.text).toContain('ui/notifications/tool-result');
      expect(c.text).toContain('ui/initialize');
      expect(c.text).toContain('ui/notifications/initialized');
      expect(c.text).toContain('ui/notifications/host-context-changed');
    }, 'resources/read ui widget');
  });

  test('resources/read Skybridge URI returns same widget with text/html+skybridge', async () => {
    const result = await mcpConnection.client.readResource({ uri: KAIROS_SPACES_UI_SKYBRIDGE_URI });
    withRawOnFail(result, () => {
      expect(result.contents?.length).toBeGreaterThan(0);
      const c = result.contents![0];
      expect(c.uri).toBe(KAIROS_SPACES_UI_SKYBRIDGE_URI);
      expect(c.mimeType).toBe(SKYBRIDGE_HTML_MIME_TYPE);
      expect(typeof c.text).toBe('string');
      expect(c.text).toContain('ui/initialize');
      expect(c.text).toContain('KAIROS');
    }, 'resources/read skybridge widget');
  });

  test('resources/read ui://kairos/forward-result returns forward MCP App HTML', async () => {
    const result = await mcpConnection.client.readResource({ uri: 'ui://kairos/forward-result' });
    withRawOnFail(result, () => {
      expect(result.contents?.length).toBeGreaterThan(0);
      const c = result.contents![0];
      expect(c.uri).toBe('ui://kairos/forward-result');
      expect(c.mimeType).toBe(MCP_APP_HTML_MIME_TYPE);
      expect(typeof c.text).toBe('string');
      expect(c.text).toContain('kairos-forward-view');
      expect(c.text).toContain('isForwardStructured');
    }, 'resources/read forward widget');
  });

  test('resources/read forward Skybridge URI returns text/html+skybridge', async () => {
    const result = await mcpConnection.client.readResource({ uri: KAIROS_FORWARD_UI_SKYBRIDGE_URI });
    withRawOnFail(result, () => {
      expect(result.contents?.length).toBeGreaterThan(0);
      const c = result.contents![0];
      expect(c.uri).toBe(KAIROS_FORWARD_UI_SKYBRIDGE_URI);
      expect(c.mimeType).toBe(SKYBRIDGE_HTML_MIME_TYPE);
      expect(c.text).toContain('kairos-forward-view');
    }, 'resources/read forward skybridge');
  });
});
