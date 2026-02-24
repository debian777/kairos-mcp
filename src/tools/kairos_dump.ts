import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import type { Memory, ProofOfWorkDefinition } from '../types/memory.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { buildChallengeShapeForDisplay } from './kairos_next-pow-helpers.js';
import { resolveChainFirstStep } from '../services/chain-utils.js';
import { redisCacheService } from '../services/redis-cache.js';
import { structuredLogger } from '../utils/structured-logger.js';

const DUMP_TOOL_NAME = 'kairos_dump';

const dumpInputSchema = z.object({
  uri: z.string().min(1).describe('kairos://mem/{uuid}'),
  protocol: z.boolean().optional().default(false).describe('If true, return full chain as one markdown document')
});

function normalizeUri(value: string): { uuid: string; uri: string } {
  const normalized = (value || '').trim();
  const uuid = normalized.split('/').pop();
  if (!uuid) {
    throw new Error('Invalid kairos://mem URI');
  }
  const uri = normalized.startsWith('kairos://mem/') ? normalized : `kairos://mem/${uuid}`;
  return { uuid, uri };
}

async function loadMemory(memoryStore: MemoryQdrantStore, uuid: string): Promise<Memory | null> {
  const cached = await redisCacheService.getMemoryResource(uuid);
  if (cached) return cached;
  const memory = await memoryStore.getMemory(uuid);
  if (memory) await redisCacheService.setMemoryResource(memory);
  return memory;
}

/** Serialize proof-of-work as a JSON code block only (no legacy line format). */
function challengeBlock(pow: ProofOfWorkDefinition | undefined): string {
  if (!pow) return '';
  return '\n\n```json\n' + JSON.stringify({ challenge: pow }) + '\n```';
}

function buildMarkdownDocSingle(memory: Memory): string {
  const body = extractMemoryBody(memory.text);
  return body + challengeBlock(memory.proof_of_work);
}

function buildMarkdownDocProtocol(memories: Memory[]): string {
  if (memories.length === 0) return '';
  const chainLabel = memories[0]!.chain?.label ?? memories[0]!.label ?? 'Protocol';
  const parts: string[] = ['# ' + chainLabel];
  for (const m of memories) {
    const body = extractMemoryBody(m.text);
    parts.push('## ' + m.label + '\n\n' + body + challengeBlock(m.proof_of_work));
  }
  return parts.join('\n\n');
}

export interface DumpParams {
  uri: string;
  protocol?: boolean;
}

/** Execute dump logic; used by MCP tool and HTTP API. */
export async function executeDump(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  params: DumpParams
): Promise<Record<string, unknown>> {
  const { uri, protocol = false } = params;
  const { uuid, uri: normalizedUri } = normalizeUri(uri);

  const memory = await loadMemory(memoryStore, uuid);
  if (!memory) {
    const err = new Error('Memory not found');
    (err as any).statusCode = 404;
    throw err;
  }

  if (protocol && memory.chain) {
    const firstStep = await resolveChainFirstStep(memory, qdrantService);
    if (!firstStep?.uuid) {
      return {
        markdown_doc: buildMarkdownDocSingle(memory),
        uri: normalizedUri,
        label: memory.label,
        chain_label: memory.chain?.label ?? null,
        step_count: 1
      };
    }
    const chainId = memory.chain.id;
    const chainLabel = memory.chain.label;
    const stepCount = memory.chain.step_count;
    const points = qdrantService && typeof qdrantService.getChainMemories === 'function'
      ? await qdrantService.getChainMemories(chainId)
      : [];
    const memories: Memory[] = [];
    for (const pt of points) {
      const m = await loadMemory(memoryStore, pt.uuid);
      if (m) memories.push(m);
    }
    memories.sort((a, b) => (a.chain?.step_index ?? 0) - (b.chain?.step_index ?? 0));
    const headUri = `kairos://mem/${firstStep.uuid}`;
    return {
      markdown_doc: buildMarkdownDocProtocol(memories),
      uri: headUri,
      label: chainLabel,
      chain_label: chainLabel,
      step_count: stepCount
    };
  }

  const out: Record<string, unknown> = {
    markdown_doc: buildMarkdownDocSingle(memory),
    uri: normalizedUri,
    label: memory.label,
    chain_label: memory.chain?.label ?? null
  };
  if (memory.chain) {
    out['position'] = {
      step_index: memory.chain.step_index,
      step_count: memory.chain.step_count
    };
  }
  const challenge = buildChallengeShapeForDisplay(memory.proof_of_work);
  if (challenge && Object.keys(challenge).length > 0) {
    out['challenge'] = challenge;
  }
  return out;
}

export interface RegisterDumpOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export function registerKairosDumpTool(
  server: any,
  memoryStore: MemoryQdrantStore,
  options: RegisterDumpOptions = {}
) {
  const toolName = options.toolName ?? DUMP_TOOL_NAME;
  const qdrantService = options.qdrantService;

  server.registerTool(
    toolName,
    {
      title: 'Inspect memory or protocol (read-only)',
      description: getToolDoc('kairos_dump') ?? 'Returns markdown_doc for use with kairos_update or kairos_mint.',
      inputSchema: dumpInputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const spaceId = getSpaceContextFromStorage()?.defaultWriteSpaceId ?? 'default';
      structuredLogger.debug(`kairos_dump space_id=${spaceId}`);
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      const respond = (payload: any) => {
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(payload).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], structuredContent: payload };
      };

      try {
        const payload = await executeDump(memoryStore, qdrantService, params as DumpParams);
        return respond(payload);
      } catch (error) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        structuredLogger.debug(`kairos_dump error space_id=${spaceId}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
  );
}
