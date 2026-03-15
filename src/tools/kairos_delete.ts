import type { QdrantService } from '../services/qdrant/service.js';
import { qdrantService as qdrantServiceSingleton } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import { deleteInputSchema, deleteOutputSchema, type DeleteInput, type DeleteOutput } from './kairos_delete_schema.js';

/** Shared execute: delete memories by URIs. Used by MCP tool and HTTP route. */
export async function executeDelete(
  qdrantService: QdrantService,
  input: DeleteInput
): Promise<DeleteOutput> {
  const { uris } = input;
  const results: DeleteOutput['results'] = [];
  let totalDeleted = 0;
  let totalFailed = 0;

  for (const uri of uris) {
    try {
      const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
      if (!uuid) {
        throw new Error('Invalid URI format');
      }
      await qdrantService.deleteMemory(uuid);
      results.push({
        uri,
        status: 'deleted',
        message: `Memory ${uri} deleted successfully`
      });
      totalDeleted++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        uri,
        status: 'error',
        message: `Failed to delete memory: ${errorMessage}`
      });
      totalFailed++;
    }
  }

  return {
    results,
    total_deleted: totalDeleted,
    total_failed: totalFailed
  };
}

export function registerKairosDeleteTool(server: any, toolName = 'kairos_delete') {
  const qdrantService = qdrantServiceSingleton;
  server.registerTool(
    toolName,
    {
      title: 'Delete KAIROS Memory',
      description: getToolDoc('kairos_delete'),
      inputSchema: deleteInputSchema,
      outputSchema: deleteOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = deleteInputSchema.parse(params);
        const result = await executeDelete(qdrantService, input);
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(result).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result
        };
      } catch (error) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        throw error;
      }
    }
  );
}
