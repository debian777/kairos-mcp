import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { structuredLogger } from './utils/structured-logger.js';
import { registerDocsResources } from './resources/docs-resources.js';
import { registerPromptResources } from './resources/prompt-resources.js';
import { bootstrapEmptyResourceHandlers } from './resources/resource-bootstrap.js';
import { MemoryQdrantStore } from './services/memory/store.js';
import { qdrantService } from './services/qdrant/index.js';
import { getBuildVersion } from './utils/build-version.js';
import { LOG_LEVEL, LOG_FORMAT, TRANSPORT_TYPE, getQdrantUrl, getQdrantCollection, QDRANT_API_KEY, QDRANT_RESCORE_STRING, TEI_BASE_URL, TEI_MODEL, KAIROS_SEARCH_OVERFETCH_FACTOR, KAIROS_SEARCH_MAX_FETCH, KAIROS_ENABLE_GROUP_COLLAPSE } from './config.js';
import { getEmbeddingDimension } from './services/embedding/config.js';
// removed: debug tools (kb_version, kb_cache_stats)
import { registerDeleteTool } from './tools/delete.js';
import { kairosServerUiCapabilityBlock } from './mcp-apps/kairos-server-ui-capability.js';
import { registerActivateUiResources } from './mcp-apps/register-activate-ui-resources.js';
import { registerForwardUiResources } from './mcp-apps/register-forward-ui-resources.js';
import { registerSpacesUiResources } from './mcp-apps/register-spaces-ui-resources.js';
import { registerSpacesTool } from './tools/spaces.js';
import { registerActivateTool } from './tools/activate.js';
import { registerForwardTool } from './tools/forward-register.js';
import { registerTrainTool } from './tools/train.js';
import { registerRewardTool } from './tools/reward.js';
import { registerTuneTool } from './tools/tune.js';
import { registerExportTool } from './tools/export.js';
import { activateInputSchema, activateOutputSchema } from './tools/activate_schema.js';
import { deleteInputSchema, deleteOutputSchema } from './tools/delete_schema.js';
import { exportInputSchema, exportOutputSchema } from './tools/export_schema.js';
import { forwardInputSchema, forwardOutputSchema } from './tools/forward_schema.js';
import { rewardInputSchema, rewardOutputSchema } from './tools/reward_schema.js';
import { spacesInputSchema, spacesOutputSchema } from './tools/spaces_schema.js';
import { trainInputSchema, trainOutputSchema } from './tools/train_schema.js';
import { tuneInputSchema, tuneOutputSchema } from './tools/tune_schema.js';
import { resolveToolDoc } from './utils/mcp-tool-doc-runtime.js';
import { zodToInputJsonSchema, zodToOutputJsonSchema } from './utils/zod-to-jsonschema.js';
import {
  KAIROS_ACTIVATE_TOOL_UI_META,
  KAIROS_FORWARD_TOOL_UI_META,
  KAIROS_SPACES_TOOL_UI_META
} from './mcp-apps/kairos-ui-constants.js';

const KAIROS_TOOL_REGISTRY = [
  {
    name: 'activate',
    title: 'Activate the best adapter',
    uiMeta: KAIROS_ACTIVATE_TOOL_UI_META,
    description:
      resolveToolDoc('activate') ||
      'Find the best adapter for the current input and return ranked activation choices.',
    strictInputSchema: activateInputSchema,
    outputSchema: activateOutputSchema
  },
  {
    name: 'forward',
    title: 'Run adapter forward pass',
    uiMeta: KAIROS_FORWARD_TOOL_UI_META,
    description:
      resolveToolDoc('forward') ||
      'Run the first or next adapter layer. Omit `solution` on the first call in a run.',
    strictInputSchema: forwardInputSchema,
    outputSchema: forwardOutputSchema
  },
  {
    name: 'train',
    title: 'Register a new adapter',
    description: resolveToolDoc('train') || 'Store a new adapter from markdown.',
    strictInputSchema: trainInputSchema,
    outputSchema: trainOutputSchema
  },
  {
    name: 'reward',
    title: 'Record adapter reward',
    description: resolveToolDoc('reward') || 'Attach a reward signal after adapter execution completes.',
    strictInputSchema: rewardInputSchema,
    outputSchema: rewardOutputSchema
  },
  {
    name: 'tune',
    title: 'Update adapter content',
    description: resolveToolDoc('tune') || 'Update adapter layer content.',
    strictInputSchema: tuneInputSchema,
    outputSchema: tuneOutputSchema
  },
  {
    name: 'delete',
    title: 'Delete KAIROS adapter resource',
    description: resolveToolDoc('delete') || 'Delete an adapter or layer by URI.',
    strictInputSchema: deleteInputSchema,
    outputSchema: deleteOutputSchema
  },
  {
    name: 'export',
    title: 'Export adapter or training data',
    description: resolveToolDoc('export') || 'Export adapter markdown or training datasets.',
    strictInputSchema: exportInputSchema,
    outputSchema: exportOutputSchema
  },
  {
    name: 'spaces',
    title: 'List spaces and adapter counts',
    uiMeta: KAIROS_SPACES_TOOL_UI_META,
    description:
      resolveToolDoc('spaces') ??
      "List the agent's available spaces with human-readable names and adapter counts. Optionally include adapter titles and layer counts per space.",
    strictInputSchema: spacesInputSchema,
    outputSchema: spacesOutputSchema
  }
] as const;

function installStrictToolsListHandler(server: McpServer): void {
  server.server.removeRequestHandler('tools/list');
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: KAIROS_TOOL_REGISTRY.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: zodToInputJsonSchema(tool.strictInputSchema),
      outputSchema: zodToOutputJsonSchema(tool.outputSchema),
      ...('uiMeta' in tool && tool.uiMeta ? { _meta: tool.uiMeta } : {})
    }))
  }));
}

// Create and configure the MCP server
export function createServer(memoryStore: MemoryQdrantStore): McpServer {
    const server = new McpServer(
        {
            name: 'KAIROS',
            version: getBuildVersion()
        },
        {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
                ...kairosServerUiCapabilityBlock
            } as ServerCapabilities
        }
    );

    // Register the current MCP tools.
    registerActivateTool(server, memoryStore, { qdrantService });
    registerForwardTool(server, memoryStore, { qdrantService });
    registerTrainTool(server, memoryStore, { qdrantService });
    registerRewardTool(server, qdrantService);
    registerTuneTool(server, memoryStore, { qdrantService });
    registerDeleteTool(server, 'delete');
    registerExportTool(server, memoryStore, { qdrantService });
    registerSpacesTool(server, memoryStore, { toolName: 'spaces' });
    installStrictToolsListHandler(server);
    registerSpacesUiResources(server);
    registerForwardUiResources(server);
    registerActivateUiResources(server);

    // Register resources
    bootstrapEmptyResourceHandlers(server);
    // Register docs resources (from embedded-mcp-resources)
    registerDocsResources(server);

    // Register prompts (from embedded-mcp-resources)
    registerPromptResources(server);

    // Log runtime configuration (mask secrets)
    const mask = (v?: string) => (v ? `${v.slice(0, 2)}***${v.slice(-2)}` : undefined);
    const config = {
        log: {
            level: LOG_LEVEL,
            format: LOG_FORMAT,
        },
        transport: {
            type: TRANSPORT_TYPE,
        },
        qdrant: {
            url: getQdrantUrl(),
            collection: getQdrantCollection(),
            apiKey: mask(QDRANT_API_KEY),
            rescore: QDRANT_RESCORE_STRING,
        },
        tei: {
            url: TEI_BASE_URL,
            model: TEI_MODEL,
            dim_env: getEmbeddingDimension(),
        },
        search: {
            overfetch: KAIROS_SEARCH_OVERFETCH_FACTOR,
            maxFetch: KAIROS_SEARCH_MAX_FETCH,
            groupCollapse: KAIROS_ENABLE_GROUP_COLLAPSE
        },
    };
    structuredLogger.debug(`runtime config ${JSON.stringify(config)}`);
    structuredLogger.debug('MCP server created and configured');
    return server;
}
