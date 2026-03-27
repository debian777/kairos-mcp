/**
 * MCP Apps (SEP-1865) identifiers for KAIROS.
 *
 * Host-owned chrome (tool row icon, connector tile) is outside MCP; branding
 * here applies to server-delivered HTML inside the chat widget iframe only.
 */
export const KAIROS_SPACES_UI_URI = 'ui://kairos/spaces-result' as const;

/**
 * Same spaces widget HTML as {@link KAIROS_SPACES_UI_URI} for hosts that expect
 * the Skybridge-style HTML MIME profile (mirrors common `ui://open-ai/...` URIs).
 */
export const KAIROS_SPACES_UI_SKYBRIDGE_URI = 'ui://open-ai/kairos/spaces-result' as const;

/** MCP Apps HTML resource for inline `forward` tool results. */
export const KAIROS_FORWARD_UI_URI = 'ui://kairos/forward-result' as const;

/** Same forward widget with Skybridge HTML MIME profile. */
export const KAIROS_FORWARD_UI_SKYBRIDGE_URI = 'ui://open-ai/kairos/forward-result' as const;

/** `forward` tool: MCP Apps widget binding (tools/list + registerTool). */
export const KAIROS_FORWARD_TOOL_UI_META = {
  ui: {
    resourceUri: KAIROS_FORWARD_UI_URI,
    visibility: ['model', 'app'] as const
  }
} as const;

/** SEP-1865 extension id (`io.modelcontextprotocol/ui`). */
export const MCP_UI_EXTENSION_ID = 'io.modelcontextprotocol/ui' as const;

/** MVP MCP Apps HTML MIME type (matches `@modelcontextprotocol/ext-apps` RESOURCE_MIME_TYPE). */
export const MCP_APP_HTML_MIME_TYPE = 'text/html;profile=mcp-app' as const;

/** Skybridge / OpenAI-style widget HTML MIME type (same document shape, different profile). */
export const SKYBRIDGE_HTML_MIME_TYPE = 'text/html+skybridge' as const;
