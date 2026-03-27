import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  KAIROS_FORWARD_UI_SKYBRIDGE_URI,
  KAIROS_FORWARD_UI_URI,
  MCP_APP_HTML_MIME_TYPE,
  SKYBRIDGE_HTML_MIME_TYPE
} from './kairos-ui-constants.js';
import { buildForwardWidgetHtml } from './forward-widget-html.js';

function readForwardWidget(uri: string, mimeType: string) {
  const text = buildForwardWidgetHtml();
  return {
    contents: [{ uri, mimeType, text }]
  };
}

/** Registers MCP App and Skybridge HTML resources for the forward chat widget. */
export function registerForwardUiResources(server: McpServer): void {
  server.registerResource(
    'kairos-forward-widget',
    KAIROS_FORWARD_UI_URI,
    {
      title: 'KAIROS forward result',
      description: 'Inline view for the forward tool (adapter, space, current layer).',
      mimeType: MCP_APP_HTML_MIME_TYPE
    },
    () => readForwardWidget(KAIROS_FORWARD_UI_URI, MCP_APP_HTML_MIME_TYPE)
  );

  server.registerResource(
    'kairos-forward-widget-skybridge',
    KAIROS_FORWARD_UI_SKYBRIDGE_URI,
    {
      title: 'KAIROS forward result (Skybridge profile)',
      description: 'Same forward widget with text/html+skybridge for hosts that require that profile.',
      mimeType: SKYBRIDGE_HTML_MIME_TYPE
    },
    () => readForwardWidget(KAIROS_FORWARD_UI_SKYBRIDGE_URI, SKYBRIDGE_HTML_MIME_TYPE)
  );
}
