import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { redisCacheService } from '../services/redis-cache.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { qdrantService } from '../services/qdrant/index.js';
import { resolveChainFirstStep, resolveChainNextStep, resolveChainPreviousStep } from '../services/chain-utils.js';
import { getTemplate } from './embedded-mcp-resources.js';

export function registerMemoryResource(server: any, memoryStore: MemoryQdrantStore) {
  server.registerResource(
    'kairos_memory',
    new ResourceTemplate('kairos://mem/{uuid}', { list: undefined }),
    {
      title: 'KAIROS Memory',
      description: getTemplate('kairos-memory') || 'Retrieves a KAIROS memory by UUID',
      mimeType: 'text/markdown'
    },
    async (uri: URL, { uuid }: { uuid: string }) => {
      if (!uuid) {
        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: 'Invalid UUID' }]
        };
      }

      // Check Redis cache first
      let memory = await redisCacheService.getMemoryResource(uuid);
      if (!memory) {
        // Cache miss - fetch from store
        memory = await memoryStore.getMemory(uuid, { fresh: true });
        if (memory) {
          // Cache the memory for future requests
          await redisCacheService.setMemoryResource(memory);
        }
      }

      if (!memory) {
        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: 'Memory not found' }]
        };
      }

      // Safety: ensure the UUID in the resource URI matches the stored memory UUID
      // If they differ, log a warning (do not print into render).
      const requestedUuid = uuid;
      const actualUuid = memory.memory_uuid;
      if (actualUuid && requestedUuid !== actualUuid) {
        structuredLogger.warn(
          `kairos://mem resource UUID mismatch: uri=${requestedUuid} stored=${actualUuid}`
        );
      }

      // Try to resolve the next/first/previous steps within the chain for header/footer rendering
      const next = await resolveChainNextStep(memory, qdrantService).catch(() => undefined);
      const firstStep = await resolveChainFirstStep(memory, qdrantService).catch(() => undefined);
      const previous = await resolveChainPreviousStep(memory, qdrantService).catch(() => undefined);

      // Resolve game info (step + workflow potential) for header/footer
      const game = await resolveGameInfo(memory).catch(() => undefined);

      const payload = renderMemory(memory, requestedUuid, next, game, firstStep, previous);
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: payload }]
      };
    }
  );
}


type LoadedMemory = NonNullable<Awaited<ReturnType<MemoryQdrantStore['getMemory']>>>;

function renderMemory(
  memory: LoadedMemory,
  requestedUuid?: string,
  nextInfo?: { uuid: string; label?: string; step?: number; count?: number },
  gameInfo?: { stepPotential?: number; workflowPotential?: number; stepQuality?: string },
  firstInfo?: { uuid: string; label?: string; step?: number } | undefined,
  prevInfo?: { uuid: string; label?: string; step?: number } | undefined
) {
  if (!memory) return 'Memory not found';
  const lines: string[] = [];
  // HEADER
  lines.push('<!-- KAIROS:HEADER -->');
  // There is no 'protocol' field in Qdrant payloads; if memory is part of a chain we
  // treat it as a strict sequential protocol per Memory Format v2.
  if (memory.chain) {
    lines.push('ProtocolMode: strict_sequential');
  }
  lines.push(`Label: ${memory.label}`);
  if (memory.chain?.label) {
    lines.push(`ChainTitle: ${memory.chain.label}`);
  }
  if (memory.chain) {
    lines.push(`Position: ${memory.chain.step_index}/${memory.chain.step_count}`);
  }
  // ProtocolId maps to the stable chain identifier used to reconstruct protocol sequences
  if (memory.chain) {
    lines.push(`ProtocolId: ${memory.chain.id}`);
  }
  // Include explicit chain navigation references (FirstStep must always be present per v2)
  if (firstInfo && firstInfo.uuid) {
    lines.push(`FirstStep: kairos://mem/${firstInfo.uuid}`);
  } else {
    // Fallback: point FirstStep to itself when chain head is unknown
    lines.push(`FirstStep: kairos://mem/${memory.memory_uuid}`);
  }
  if (prevInfo && prevInfo.uuid) {
    lines.push(`Previous: kairos://mem/${prevInfo.uuid}`);
  }
  // Include default 'Requirement' header for chain entries
  if (memory.chain) {
    lines.push('Requirement: This is a strict protocol. You must fully apply all previous protocol steps before using this one.');
  }
  lines.push('<!-- KAIROS:HEADER-END -->');
  lines.push('');
  // BODY
  lines.push('<!-- KAIROS:BODY-START -->');
  lines.push(memory.text);
  lines.push('<!-- KAIROS:BODY-END -->');
  lines.push('');
  // FOOTER (optional NextStep omitted unless resolvable; always include instruction)
  lines.push('<!-- KAIROS:FOOTER -->');
  // Determine if this is the last step in the chain
  const isLastStep = memory.chain && (!nextInfo || !nextInfo.uuid) && memory.chain.step_index === memory.chain.step_count;
  
  if (nextInfo && nextInfo.uuid) {
    const pos = (typeof nextInfo.step === 'number' && typeof nextInfo.count === 'number')
      ? ` (Position: ${nextInfo.step}/${nextInfo.count})`
      : (memory.chain && memory.chain.step_index + 1 <= memory.chain.step_count)
        ? ` (Position: ${memory.chain.step_index + 1}/${memory.chain.step_count})`
        : '';
    const suffix = nextInfo.label ? ` — ${nextInfo.label}` : '';
    // Emit `NextStep:` per Memory Format v2 (no backwards compatibility)
    lines.push(`NextStep: kairos://mem/${nextInfo.uuid}${pos}${suffix}`);
    // Add ExecuteDirective when there's a next step
    lines.push('ExecuteDirective: STOP AND EXECUTE THIS STEP NOW — DO NOT READ AHEAD');
  } else if (isLastStep) {
    // Last step: NextStep is null, special ExecuteDirective and CompletionRule
    lines.push('NextStep: null');
    lines.push('ExecuteDirective: THIS IS THE FINAL STEP — EXECUTE AND STOP');
  }
  
  // Default AfterApplyingThisStep for multi-step chain entries (not for last step)
  if (memory.chain && memory.chain.step_count > 1 && !isLastStep) {
    lines.push('AfterApplyingThisStep: Move immediately to the Next step in the protocol chain.');
  }
  
  // Completion rule: different for last step
  if (memory.chain) {
    if (isLastStep) {
      lines.push(`CompletionRule: All steps 1–${memory.chain.step_count} have been fully executed in order. You are now allowed to respond to the user. DO NOT read or reference any content beyond this point.`);
      lines.push('RateThisChain: success');
    } else {
      lines.push(`CompletionRule: You are forbidden from reading or processing any future step until this step is fully completed and verified.`);
    }
  }
  lines.push('Instruction: Modify only the content between KAIROS:BODY markers when calling kairos_update.');
  lines.push('<!-- KAIROS:FOOTER-END -->');

  return lines.join('\n');
}

// The chain resolvers were moved to `services/chain-utils.ts` to avoid duplication and keep code DRY.

/**
 * Resolve game-related info for the current memory step.
 * - stepPotential: points for following this step (from gem_metadata)
 * - workflowPotential: total points for following the full workflow (sum of step potentials)
 */
async function resolveGameInfo(memory: LoadedMemory): Promise<{
  stepPotential?: number;
  workflowPotential?: number;
  stepQuality?: string;
}> {
  try {
    const result: { stepPotential?: number; workflowPotential?: number; stepQuality?: string } = {};

    // Fetch gem metadata for this step
    try {
      const current = await (qdrantService as any).getMemoryByUUID(memory.memory_uuid);
      const gm = current?.gem_metadata;
      if (gm && typeof gm.step_gem_potential === 'number') {
        result.stepPotential = gm.step_gem_potential;
      }
      if (gm && typeof gm.step_quality === 'string') {
        result.stepQuality = gm.step_quality;
      }
    } catch {
      try { structuredLogger.debug(`memory-resource: step gem metadata unavailable for ${memory.memory_uuid}`); } catch { }
    }

    // If part of a chain, compute total workflow potential by summing step potentials
    if (memory.chain) {
      try {
        const points: any[] = await (qdrantService as any).getChainMemories(memory.chain.id);
        if (Array.isArray(points) && points.length > 0) {
          const total = points.reduce((sum, pt) => {
            const sp = Number(pt?.payload?.gem_metadata?.step_gem_potential ?? 1);
            return sum + (Number.isFinite(sp) ? sp : 1);
          }, 0);
          if (Number.isFinite(total)) {
            result.workflowPotential = total;
          }
        }
      } catch (e) {
        try { structuredLogger.debug(`memory-resource: workflow potential calc failed: ${e instanceof Error ? e.message : String(e)}`); } catch { }
      }
    }

    return result;
  } catch {
    return {};
  }
}
