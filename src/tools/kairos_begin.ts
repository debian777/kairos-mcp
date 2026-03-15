import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep, resolveChainFirstStep } from '../services/chain-utils.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage } from '../utils/tenant-context.js';
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

function buildKairosBeginPayload(
  memory: Memory | null,
  requestedUri: string,
  nextStepUri: string | null,
  challenge: any,
  redirectMessage?: string
) {
  const current_step = buildCurrentStep(memory, requestedUri);
  const currentStepUri = current_step.uri;

  const payload: any = {
    must_obey: true as const,
    current_step,
    challenge: challenge ?? {}
  };

  if (redirectMessage) {
    payload.message = redirectMessage;
  }

  if (nextStepUri) {
    payload.next_action = `call kairos_next with ${currentStepUri} and solution matching challenge`;
  } else {
    payload.message = 'Single-step protocol. Call kairos_attest to finalize.';
    payload.next_action = `call kairos_attest with ${requestedUri} and outcome (success or failure) and message to complete the protocol`;
  }

  return payload;
}

import { z } from 'zod';
import { buildBeginSchemas } from './kairos_begin_schema.js';

const beginSchemas = buildBeginSchemas();
export const beginInputSchema = beginSchemas.inputSchema;
export const beginOutputSchema = beginSchemas.outputSchema;
export type BeginInput = z.infer<typeof beginInputSchema>;
export type BeginOutput = z.infer<typeof beginOutputSchema>;

/**
 * Shared execute: load step 1 (with auto-redirect) and return challenge/next_action. Used by MCP tool and HTTP route.
 */
export async function executeBegin(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: BeginInput
): Promise<BeginOutput> {
  const { uuid, uri: requestedUri } = normalizeMemoryUri(input.uri);
  let memory = await loadMemoryWithCache(memoryStore, uuid);
  let redirectMessage: string | undefined;

  if (memory?.chain && memory.chain.step_index !== 1) {
    const firstStep = await resolveChainFirstStep(memory, qdrantService);
    if (firstStep?.uuid) {
      const step1Memory = await loadMemoryWithCache(memoryStore, firstStep.uuid);
      if (step1Memory) {
        memory = step1Memory;
        redirectMessage = 'Redirected to step 1 of this protocol chain.';
      }
    }
  }

  const nextStepInfo = memory
    ? await resolveChainNextStep(memory, qdrantService)
    : undefined;
  const nextStepUri = nextStepInfo?.uuid ? `kairos://mem/${nextStepInfo.uuid}` : null;
  const challenge = await buildChallenge(memory, memory?.proof_of_work);
  return buildKairosBeginPayload(memory, requestedUri, nextStepUri, challenge, redirectMessage) as BeginOutput;
}

export function registerBeginTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterBeginOptions = {}) {
  const toolName = options.toolName || 'kairos_begin';
  structuredLogger.debug(`kairos_begin registration inputSchema: ${JSON.stringify(beginInputSchema)}`);
  structuredLogger.debug(`kairos_begin registration outputSchema: ${JSON.stringify(beginOutputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Start protocol execution',
      description: getToolDoc('kairos_begin') || 'Loads step 1 and returns the first challenge. Auto-redirects to step 1 if non-step-1 URI is provided.',
      inputSchema: beginInputSchema,
      outputSchema: beginOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      const spaceId = getSpaceContextFromStorage()?.defaultWriteSpaceId ?? 'default';
      structuredLogger.debug(`kairos_begin space_id=${spaceId}`);
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });
      const respond = (payload: BeginOutput) => {
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(payload).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
          structuredContent: payload
        };
      };
      try {
        const input = beginInputSchema.parse(params);
        const output = await executeBegin(memoryStore, options.qdrantService, input);
        return respond(output);
      } catch (error) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        throw error;
      }
    }
  );
}
