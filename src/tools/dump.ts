import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import type { Memory, ProofOfWorkDefinition } from '../types/memory.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { buildProtocolYamlFrontmatter, stripRedundantStepH2 } from '../utils/dump-markdown.js';
import { slugifyFromTitle } from '../utils/protocol-slug.js';
import { buildChallengeShapeForDisplay } from './next-pow-helpers.js';
import { resolveChainFirstStep } from '../services/chain-utils.js';
import { redisCacheService } from '../services/redis-cache.js';

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

/** Serialize proof-of-work as a JSON code block only (no older line format). */
function challengeBlock(proofOfWork: ProofOfWorkDefinition | undefined): string {
  if (!proofOfWork) return '';
  return `\n\n\`\`\`json\n${JSON.stringify({ challenge: proofOfWork })}\n\`\`\``;
}

function buildMarkdownDocSingle(memory: Memory): string {
  const body = extractMemoryBody(memory.text);
  return body + challengeBlock(memory.proof_of_work);
}

function buildMarkdownDocProtocol(memories: Memory[]): string {
  if (memories.length === 0) return '';
  const chainLabel = memories[0]!.chain?.label ?? memories[0]!.label ?? 'Protocol';
  const parts: string[] = [`# ${chainLabel}`];
  for (const memory of memories) {
    const body = extractMemoryBody(memory.text);
    const bodyStripped = stripRedundantStepH2(body, memory.label);
    parts.push(`## ${memory.label}\n\n${bodyStripped}${challengeBlock(memory.proof_of_work)}`);
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

  let memory = await loadMemory(memoryStore, uuid);
  if (!memory && qdrantService && typeof qdrantService.getChainMemories === 'function') {
    const chainPoints = await qdrantService.getChainMemories(uuid);
    const firstUuid = chainPoints[0]?.uuid;
    if (firstUuid) memory = await loadMemory(memoryStore, firstUuid);
  }
  if (!memory) {
    const error = new Error('Memory not found');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  if (protocol && memory.chain) {
    const firstStep = await resolveChainFirstStep(memory, qdrantService);
    if (!firstStep?.uuid) {
      return {
        markdown_doc: buildMarkdownDocSingle(memory),
        uri: normalizedUri,
        label: memory.label,
        chain_label: memory.chain?.label ?? null,
        step_count: 1,
        ...(memory.chain?.protocol_version && { protocol_version: memory.chain.protocol_version })
      };
    }
    const chainId = memory.chain.id;
    const chainLabel = memory.chain.label;
    const stepCount = memory.chain.step_count;
    const protocolVersion = memory.chain.protocol_version;
    const points = qdrantService && typeof qdrantService.getChainMemories === 'function'
      ? await qdrantService.getChainMemories(chainId, memory.space_id ? [memory.space_id] : undefined)
      : [];
    const memories: Memory[] = [];
    for (const point of points) {
      const currentMemory = await loadMemory(memoryStore, point.uuid);
      if (currentMemory) memories.push(currentMemory);
    }
    memories.sort((left, right) => (left.chain?.step_index ?? 0) - (right.chain?.step_index ?? 0));
    const headUri = `kairos://mem/${firstStep.uuid}`;
    const headSlug = memories[0]?.slug?.trim();
    const slugForExport = headSlug && headSlug.length > 0 ? headSlug : slugifyFromTitle(chainLabel);
    const markdownBody = buildMarkdownDocProtocol(memories);
    const markdown_doc = buildProtocolYamlFrontmatter(slugForExport, protocolVersion) + markdownBody;
    return {
      markdown_doc,
      uri: headUri,
      label: chainLabel,
      chain_label: chainLabel,
      step_count: stepCount,
      slug: slugForExport,
      ...(protocolVersion && { protocol_version: protocolVersion })
    };
  }

  const output: Record<string, unknown> = {
    markdown_doc: buildMarkdownDocSingle(memory),
    uri: normalizedUri,
    label: memory.label,
    chain_label: memory.chain?.label ?? null
  };
  if (memory.chain) {
    output['position'] = {
      step_index: memory.chain.step_index,
      step_count: memory.chain.step_count
    };
    if (memory.chain.protocol_version) {
      output['protocol_version'] = memory.chain.protocol_version;
    }
  }
  const challenge = buildChallengeShapeForDisplay(memory.proof_of_work);
  if (challenge && Object.keys(challenge).length > 0) {
    output['challenge'] = challenge;
  }
  return output;
}
