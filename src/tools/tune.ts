import type { QdrantService } from '../services/qdrant/service.js';
import { qdrantService as qdrantServiceSingleton } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { getTenantId } from '../utils/tenant-context.js';
import { executeUpdate } from './update.js';
import { tuneInputSchema, tuneOutputSchema, type TuneInput, type TuneOutput } from './tune_schema.js';
import { parseKairosUri, buildLayerUri } from './kairos-uri.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';

async function normalizeTuneUri(qdrantService: QdrantService, uri: string): Promise<string> {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'layer') {
    return `kairos://mem/${parsed.id}`;
  }

  const layers = await qdrantService.getChainMemories(parsed.id);
  const head = layers[0]?.uuid ?? parsed.id;
  return `kairos://mem/${head}`;
}

export async function executeTune(qdrantService: QdrantService, input: TuneInput): Promise<TuneOutput> {
  const normalizedUris = await Promise.all(input.uris.map((uri) => normalizeTuneUri(qdrantService, uri)));
  const result = await executeUpdate(qdrantService, {
    uris: normalizedUris as any,
    markdown_doc: input.markdown_doc,
    updates: input.updates
  });

  return {
    results: result.results.map((entry) => ({
      uri: buildLayerUri(entry.uri.split('/').pop() ?? ''),
      status: entry.status,
      message: entry.message.replaceAll('memory', 'adapter layer')
    })),
    total_updated: result.total_updated,
    total_failed: result.total_failed
  };
}

export function registerTuneTool(server: any, toolName = 'tune') {
  const qdrantService = qdrantServiceSingleton;
  server.registerTool(
    toolName,
    {
      title: 'Update adapter content',
      description: getToolDoc('tune') || 'Update adapter layer content.',
      inputSchema: tuneInputSchema,
      outputSchema: tuneOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = tuneInputSchema.parse(params);
        const result = await executeTune(qdrantService, input);
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

