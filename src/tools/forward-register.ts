import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { getTenantId } from '../utils/tenant-context.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { forwardInputSchema, forwardOutputSchema } from './forward_schema.js';
import { executeForward } from './forward.js';
import { formatForwardToolError } from './forward-tool-error.js';
import { KairosError } from '../types/index.js';

export interface RegisterForwardOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export function registerForwardTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterForwardOptions = {}): void {
  const toolName = options.toolName || 'forward';
  const qdrantService = options.qdrantService;

  server.registerTool(
    toolName,
    {
      title: 'Run adapter forward pass',
      description: getToolDoc('forward') || 'Run the first or next adapter layer. Omitting solution starts a new execution.',
      inputSchema: forwardInputSchema,
      outputSchema: forwardOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = forwardInputSchema.parse(params);
        const output = await executeForward(server, memoryStore, qdrantService, input);
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(output).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output
        };
      } catch (error) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        if (error instanceof KairosError) {
          return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(formatForwardToolError(error)) }] };
        }
        throw error;
      }
    }
  );
}
