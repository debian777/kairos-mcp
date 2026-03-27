/**
 * `listOfferingsForUI` is not in core MCP; some chat hosts call it to prefetch
 * widget-capable tools and UI resources. Shapes mirror tools/list and UIResource
 * listings (SEP-1865 / MCP Apps).
 */
import type { Prompt } from '@modelcontextprotocol/sdk/types.js';
import { normalizeObjectSchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { listPromptOfferings } from '../resources/prompt-resources.js';
import { forwardInputSchema, forwardOutputSchema } from '../tools/forward_schema.js';
import { spacesInputSchema, spacesOutputSchema } from '../tools/spaces_schema.js';
import {
  KAIROS_FORWARD_TOOL_UI_META,
  KAIROS_FORWARD_UI_SKYBRIDGE_URI,
  KAIROS_FORWARD_UI_URI,
  KAIROS_SPACES_UI_SKYBRIDGE_URI,
  KAIROS_SPACES_UI_URI,
  MCP_APP_HTML_MIME_TYPE,
  SKYBRIDGE_HTML_MIME_TYPE
} from './kairos-ui-constants.js';

const SPACES_TOOL_NAME = 'spaces';
const FORWARD_TOOL_NAME = 'forward';

function zodToInputJsonSchema(schema: typeof spacesInputSchema | typeof forwardInputSchema): Record<string, unknown> {
  const obj = normalizeObjectSchema(schema);
  if (!obj) {
    return { type: 'object', properties: {} };
  }
  return toJsonSchemaCompat(obj, { strictUnions: true, pipeStrategy: 'input' }) as Record<string, unknown>;
}

function zodToOutputJsonSchema(schema: typeof spacesOutputSchema | typeof forwardOutputSchema): Record<string, unknown> {
  const obj = normalizeObjectSchema(schema);
  if (!obj) {
    return { type: 'object', properties: {} };
  }
  return toJsonSchemaCompat(obj, { strictUnions: true, pipeStrategy: 'output' }) as Record<string, unknown>;
}

/** Tool entry aligned with tools/list for the spaces tool including MCP Apps metadata. */
export function buildSpacesToolOffering(): Record<string, unknown> {
  return {
    name: SPACES_TOOL_NAME,
    title: 'List spaces and adapter counts',
    description:
      getToolDoc('spaces') ??
      "List the agent's available spaces with human-readable names and adapter counts.",
    inputSchema: zodToInputJsonSchema(spacesInputSchema),
    outputSchema: zodToOutputJsonSchema(spacesOutputSchema),
    _meta: {
      ui: {
        resourceUri: KAIROS_SPACES_UI_URI,
        visibility: ['model', 'app']
      }
    }
  };
}

/** Tool entry for `forward` including MCP Apps widget metadata. */
export function buildForwardToolOffering(): Record<string, unknown> {
  return {
    name: FORWARD_TOOL_NAME,
    title: 'Run adapter forward pass',
    description:
      getToolDoc('forward') ?? 'Run the first or next adapter layer. Omitting solution starts a new execution.',
    inputSchema: zodToInputJsonSchema(forwardInputSchema),
    outputSchema: zodToOutputJsonSchema(forwardOutputSchema),
    _meta: KAIROS_FORWARD_TOOL_UI_META
  };
}

/** UI resource for the forward widget (mcp-app profile). */
export function buildForwardUiResourceOffering(): Record<string, unknown> {
  return {
    uri: KAIROS_FORWARD_UI_URI,
    name: 'KAIROS forward result',
    description: 'Branded inline view for the forward tool (adapter, space, current layer).',
    mimeType: MCP_APP_HTML_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: true
      }
    }
  };
}

/** Forward widget with Skybridge MIME profile. */
export function buildForwardSkybridgeResourceOffering(): Record<string, unknown> {
  return {
    uri: KAIROS_FORWARD_UI_SKYBRIDGE_URI,
    name: 'KAIROS forward result (Skybridge profile)',
    description: 'Same forward widget markup with text/html+skybridge.',
    mimeType: SKYBRIDGE_HTML_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: true
      }
    }
  };
}

/** UI resource entry for listings (uri, name, mimeType, optional _meta.ui). */
export function buildSpacesUiResourceOffering(): Record<string, unknown> {
  return {
    uri: KAIROS_SPACES_UI_URI,
    name: 'KAIROS spaces result',
    description: 'Branded inline view for the spaces tool (logo + structured JSON).',
    mimeType: MCP_APP_HTML_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: true
      }
    }
  };
}

/** Same widget HTML with Skybridge MIME profile for alternate hosts. */
export function buildSpacesSkybridgeResourceOffering(): Record<string, unknown> {
  return {
    uri: KAIROS_SPACES_UI_SKYBRIDGE_URI,
    name: 'KAIROS spaces result (Skybridge profile)',
    description: 'Same spaces widget markup with text/html+skybridge.',
    mimeType: SKYBRIDGE_HTML_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: true
      }
    }
  };
}

export function buildListOfferingsForUIResult(): {
  tools: Record<string, unknown>[];
  prompts: Prompt[];
  resources: Record<string, unknown>[];
} {
  return {
    tools: [buildSpacesToolOffering(), buildForwardToolOffering()],
    prompts: listPromptOfferings(),
    resources: [
      buildSpacesUiResourceOffering(),
      buildSpacesSkybridgeResourceOffering(),
      buildForwardUiResourceOffering(),
      buildForwardSkybridgeResourceOffering()
    ]
  };
}
