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
import { buildChallenge } from './kairos_next-pow-helpers.js';

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

function buildKairosBeginPayload(
  memory: Memory | null,
  requestedUri: string,
  nextInfo?: ResolvedChainStep
) {
  const current_step = buildCurrentStep(memory, requestedUri);
  const next_step = buildNextStep(memory, nextInfo);
  const protocol_status = next_step ? 'continue' : 'completed';

  const payload: any = {
    must_obey: true as const,
    current_step,
    protocol_status,
    challenge: buildChallenge(memory?.proof_of_work)
  };

  // When protocol is completed, indicate that kairos_attest should be called
  if (protocol_status === 'completed') {
    payload.attest_required = true;
    payload.message = 'Protocol completed. Call kairos_attest to finalize with final_solution.';
    payload.next_action = 'call kairos_attest with final_solution';
  } else {
    payload.next_action = 'call kairos_next with uri and solution matching challenge';
  }

  return payload;
}

export function registerBeginTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterBeginOptions = {}) {
  const toolName = options.toolName || 'kairos_begin';
  const memoryUriSchema = z
    .string()
    .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

  const inputSchema = z.object({
    uri: memoryUriSchema.describe('URI of step 1 (from kairos_search.start_here)')
  });

  const challengeSchema = z.object({
    type: z.enum(['shell', 'mcp', 'user_input', 'comment']),
    description: z.string(),
    shell: z.object({
      cmd: z.string(),
      timeout_seconds: z.number()
    }).optional(),
    mcp: z.object({
      tool_name: z.string(),
      expected_result: z.any().optional()
    }).optional(),
    user_input: z.object({
      prompt: z.string().optional()
    }).optional(),
    comment: z.object({
      min_length: z.number().optional()
    }).optional()
  });

  const outputSchema = z.object({
    must_obey: z.boolean(),
    current_step: z.object({
      uri: memoryUriSchema,
      content: z.string(),
      mimeType: z.literal('text/markdown')
    }).optional().nullable(),
    challenge: challengeSchema,
    protocol_status: z.enum(['continue', 'completed']),
    attest_required: z.boolean().optional().describe('When true, indicates kairos_attest should be called to finalize the protocol'),
    message: z.string().optional(),
    next_action: z.string().optional().nullable().describe('Action to take next (e.g., "call kairos_next with uri and solution matching challenge")')
  });

  structuredLogger.debug(`kairos_begin registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_begin registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Start protocol execution',
      description: getToolDoc('kairos_begin') || 'Loads step 1 and returns the first challenge.',
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

        const memory = await loadMemoryWithCache(memoryStore, uuid);
        
        // Validate that this is step 1
        if (memory?.chain) {
          if (memory.chain.step_index !== 1) {
            return respond({
              must_obey: false,
              message: `This is step ${memory.chain.step_index}, not step 1. Use kairos_next for steps 2+.`,
              protocol_status: 'blocked'
            });
          }
        } else if (memory) {
          // If no chain info but memory exists, assume it's step 1 (standalone memory)
          // This allows backward compatibility
        }

        const nextStepInfo = memory
          ? await resolveChainNextStep(memory, options.qdrantService)
          : undefined;

        const output = buildKairosBeginPayload(memory, requestedUri, nextStepInfo);
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
