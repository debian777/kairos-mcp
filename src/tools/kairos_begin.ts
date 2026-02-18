import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep, resolveChainFirstStep } from '../services/chain-utils.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import { redisCacheService } from '../services/redis-cache.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { buildChallenge } from './kairos_next-pow-helpers.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';

interface RegisterBeginOptions {
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

function normalizeMemoryUri(value: string): { uuid: string; uri: string } {
  const normalized = (value || '').trim();
  const uuid = normalized.split('/').pop();
  if (!uuid) {
    throw new Error('Invalid kairos://mem URI');
  }
  const uri = normalized.startsWith('kairos://mem/')
    ? normalized
    : `kairos://mem/${uuid}`;
  return { uuid, uri };
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

function buildKairosBeginPayload(
  memory: Memory | null,
  requestedUri: string,
  nextStepUri: string | null,
  challenge: any,
  redirectMessage?: string
) {
  const current_step = buildCurrentStep(memory, requestedUri);

  const payload: any = {
    must_obey: true as const,
    current_step,
    challenge: challenge ?? {}
  };

  if (redirectMessage) {
    payload.message = redirectMessage;
  }

  if (nextStepUri) {
    payload.next_action = `call kairos_next with ${nextStepUri} and solution matching challenge`;
  } else {
    payload.message = 'Run complete.';
    payload.next_action = 'Run complete.';
  }

  return payload;
}

import { buildBeginSchemas } from './kairos_begin_schema.js';

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
        const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);

        let memory = await loadMemoryWithCache(memoryStore, uuid);
        let redirectMessage: string | undefined;
        
        // Auto-redirect: if not step 1, resolve and present step 1
        if (memory?.chain && memory.chain.step_index !== 1) {
          const firstStep = await resolveChainFirstStep(memory, options.qdrantService);
          if (firstStep?.uuid) {
            const step1Memory = await loadMemoryWithCache(memoryStore, firstStep.uuid);
            if (step1Memory) {
              memory = step1Memory;
              redirectMessage = 'Redirected to step 1 of this protocol chain.';
            }
          }
        }

        // Resolve next step URI
        const nextStepInfo = memory
          ? await resolveChainNextStep(memory, options.qdrantService)
          : undefined;
        const nextStepUri = nextStepInfo?.uuid
          ? `kairos://mem/${nextStepInfo.uuid}`
          : null;

        // First run is not a retry: reset retry for step 1 so the first submission in this run is never counted as a retry.
        if (memory?.memory_uuid) {
          await proofOfWorkStore.resetRetry(memory.memory_uuid);
        }
        const challenge = await buildChallenge(memory, memory?.proof_of_work);
        const output = buildKairosBeginPayload(memory, requestedUri, nextStepUri, challenge, redirectMessage);
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
