import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep, type ResolvedChainStep } from '../services/chain-utils.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import { redisCacheService } from '../services/redis-cache.js';
import { extractMemoryBody } from '../utils/memory-body.js';

interface RegisterNextOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

async function loadMemoryWithCache(memoryStore: MemoryQdrantStore, uuid: string): Promise<Memory | null> {
  const cached = await redisCacheService.getMemoryResource(uuid);
  if (cached) {
    return cached;
  }
  const memory = await memoryStore.getMemory(uuid);
  if (memory) {
    await redisCacheService.setMemoryResource(memory);
  }
  return memory;
}

function buildCurrentStep(memory: Memory | null, requestedUri: string) {
  const uri = memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri;
  const content = memory ? extractMemoryBody(memory.text) : '';
  return {
    uri,
    content,
    mimeType: 'text/markdown' as const
  };
}

function buildNextStep(
  memory: Memory | null,
  nextInfo?: ResolvedChainStep
): { uri: string; position: string; label: string } | null {
  if (!memory || !nextInfo || !nextInfo.uuid) {
    return null;
  }

  const total = Math.max(nextInfo.count ?? memory.chain?.step_count ?? 1, 1);
  const stepIndex = Math.max(nextInfo.step ?? (memory.chain ? memory.chain.step_index + 1 : 1), 1);

  return {
    uri: `kairos://mem/${nextInfo.uuid}`,
    position: `${stepIndex}/${total}`,
    label: nextInfo.label || 'Next step'
  };
}

function buildKairosNextPayload(
  memory: Memory | null,
  requestedUri: string,
  nextInfo?: ResolvedChainStep
) {
  const current_step = buildCurrentStep(memory, requestedUri);
  const next_step = buildNextStep(memory, nextInfo);
  const protocol_status = next_step ? 'continue' : 'completed';

  return {
    must_obey: true as const,
    current_step,
    next_step,
    protocol_status
  };
}
export function registerKairosNextTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterNextOptions = {}) {
  const toolName = options.toolName || 'kairos_next';

  const inputSchema = z.object({
    uri: z.string().min(1).describe('URI of the current memory step')
  });

  const outputSchema = z.object({
    must_obey: z.literal(true),
    current_step: z.object({
      uri: z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i),
      content: z.string(),
      mimeType: z.literal('text/markdown')
    }),
    next_step: z.union([
      z.object({
        uri: z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i),
        position: z.string().regex(/^\d+\/\d+$/),
        label: z.string().min(1)
      }),
      z.null()
    ]),
    protocol_status: z.enum(['continue', 'completed'])
  });

  structuredLogger.debug(`kairos_next registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_next registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Get next step in chain',
      description: getToolDoc('kairos_next'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      
      const timer = mcpToolDuration.startTimer({ 
        tool: toolName,
        tenant_id: tenantId 
      });
      
      let result: any;
      
      try {
        const { uri } = params as { uri: string };
        const normalizedUri = (uri || '').trim();
        const uuid = normalizedUri.split('/').pop();

        if (!uuid) {
          throw new Error('Invalid kairos://mem URI');
        }

        const requestedUri = normalizedUri.startsWith('kairos://mem/')
          ? normalizedUri
          : `kairos://mem/${uuid}`;

        const memory = await loadMemoryWithCache(memoryStore, uuid);
        const nextStepInfo = memory
          ? await resolveChainNextStep(memory, options.qdrantService)
          : undefined;

        const output = buildKairosNextPayload(memory, requestedUri, nextStepInfo);

        result = {
          content: [{
            type: 'text', text: JSON.stringify(output)
          }],
          structuredContent: output
        };
        
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        const outputSize = JSON.stringify(result).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        return result;
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