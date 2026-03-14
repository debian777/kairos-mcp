import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { executeBegin } from '../services/kairos-orchestration.js';
import { buildBeginSchemas } from './kairos_begin_schema.js';

interface RegisterBeginOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export function registerBeginTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterBeginOptions = {}) {
  const toolName = options.toolName || 'kairos_begin';
  const { inputSchema, outputSchema } = buildBeginSchemas();

  structuredLogger.debug(`kairos_begin registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_begin registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Start protocol execution',
      description: getToolDoc('kairos_begin') || 'Loads step 1 and returns the first challenge. Auto-redirects to step 1 if non-step-1 URI is provided.',
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const spaceId = getSpaceContextFromStorage()?.defaultWriteSpaceId ?? 'default';
      structuredLogger.debug(`kairos_begin space_id=${spaceId}`);
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);

      const timer = mcpToolDuration.startTimer({
        tool: toolName,
        tenant_id: tenantId
      });
      const respond = (payload: any) => {
        const structured = {
          content: [{
            type: 'text', text: JSON.stringify(payload)
          }],
          structuredContent: payload
        };
        mcpToolCalls.inc({
          tool: toolName,
          status: 'success',
          tenant_id: tenantId
        });
        const outputSize = JSON.stringify(structured).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        timer({
          tool: toolName,
          status: 'success',
          tenant_id: tenantId
        });
        return structured;
      };
      try {
        const { uri } = params as { uri: string };
        const output = await executeBegin(memoryStore, uri, { qdrantService: options.qdrantService });
        return respond(output);
      } catch (error) {
        mcpToolCalls.inc({
          tool: toolName,
          status: 'error',
          tenant_id: tenantId
        });
        mcpToolErrors.inc({
          tool: toolName,
          status: 'error',
          tenant_id: tenantId
        });
        timer({
          tool: toolName,
          status: 'error',
          tenant_id: tenantId
        });
        throw error;
      }
    }
  );
}
