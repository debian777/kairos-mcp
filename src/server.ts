import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from './utils/logger.js';
import { structuredLogger } from './utils/structured-logger.js';
import { registerDocsResources } from './resources/docs-resources.js';
import { registerPromptResources } from './resources/prompt-resources.js';
import { bootstrapEmptyResourceHandlers } from './resources/resource-bootstrap.js';
import { MemoryQdrantStore } from './services/memory/store.js';
import { qdrantService } from './services/qdrant/index.js';
import { getBuildVersion } from './utils/build-version.js';
import { registerKairosMintTool } from './tools/kairos_mint.js';
import { LOG_LEVEL, LOG_FORMAT, getTransportType, HTTP_ENABLED, STDIO_ENABLED, getQdrantUrl, getQdrantCollection, QDRANT_API_KEY, QDRANT_RESCORE_STRING, TEI_URL, TEI_MODEL, getEmbeddingDimension, getTeiDimension, KAIROS_SEARCH_OVERFETCH_FACTOR, KAIROS_SEARCH_MAX_FETCH, KAIROS_ENABLE_GROUP_COLLAPSE } from './config.js';
// removed: debug tools (kb_version, kb_cache_stats)
import { registerKairosUpdateTool } from './tools/kairos_update.js';
import { registerKairosDeleteTool } from './tools/kairos_delete.js';
import { registerBeginTool } from './tools/kairos_begin.js';
import { registerKairosNextTool } from './tools/kairos_next.js';
import { registerKairosAttestTool } from './tools/kairos_attest.js';

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
                prompts: {}
            }
        }
    );


    // Register kairos tools
    registerBeginTool(server, memoryStore, { qdrantService });
    registerKairosNextTool(server, memoryStore, { qdrantService });
    registerKairosMintTool(server, memoryStore);
    registerKairosAttestTool(server, qdrantService);
    registerKairosUpdateTool(server);
    registerKairosDeleteTool(server);

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
            type: getTransportType(),
            http: HTTP_ENABLED,
            stdio: STDIO_ENABLED,
        },
        qdrant: {
            url: getQdrantUrl(),
            collection: getQdrantCollection(),
            apiKey: mask(QDRANT_API_KEY),
            rescore: QDRANT_RESCORE_STRING,
        },
        tei: {
            url: TEI_URL,
            model: TEI_MODEL,
            dim_env: getEmbeddingDimension() || getTeiDimension(),
        },
        search: {
            overfetch: KAIROS_SEARCH_OVERFETCH_FACTOR,
            maxFetch: KAIROS_SEARCH_MAX_FETCH,
            groupCollapse: KAIROS_ENABLE_GROUP_COLLAPSE
        },
    };
    structuredLogger.debug(`runtime config ${JSON.stringify(config)}`);

    structuredLogger.info('MCP server created and configured');
    return server;
}

// Placeholder for optional model detection hooks
export function setupModelDetection() {
    logger.info('Model detection setup complete');
}
