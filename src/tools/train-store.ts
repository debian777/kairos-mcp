import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { parseFrontmatter } from '../utils/frontmatter.js';
import { validateProtocolStructure, CREATION_PROTOCOL_URI } from '../services/memory/validate-protocol-structure.js';
import type { TrainStoreInput, TrainStoreOutput } from './train_schema.js';

/** Fork export includes `slug:` in YAML; same author slug in target space collides — allocate fresh. */
function markdownWithoutAuthorSlugForFork(markdown: string): string {
  const p = parseFrontmatter(markdown);
  if (p.slugRaw === undefined) return markdown;
  const lines: string[] = [];
  if (p.version) lines.push(`version: ${p.version}`);
  if (p.title) lines.push(`title: ${p.title}`);
  const fm = lines.length > 0 ? `---\n${lines.join('\n')}\n---\n\n` : '';
  return `${fm}${p.body}`;
}

/** Thrown by executeTrainStore on validation or store errors. */
export class TrainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TrainError';
  }
}

/**
 * Low-level train step: validate protocol structure and persist adapter markdown.
 * Used by MCP **`train`** and HTTP routes after optional fork resolution.
 */
export async function executeTrainStore(
  memoryStore: MemoryQdrantStore,
  input: TrainStoreInput,
  runStore: (fn: () => Promise<Memory[]>) => Promise<Memory[]>
): Promise<TrainStoreOutput> {
  const docForStore = input.fork_new_adapter ? markdownWithoutAuthorSlugForFork(input.markdown_doc) : input.markdown_doc;
  const validation = validateProtocolStructure(docForStore);
  if (!validation.valid) {
    throw new TrainError('PROTOCOL_STRUCTURE_INVALID', validation.message, {
      missing: validation.missing,
      must_obey: true,
      next_action: `call forward with ${CREATION_PROTOCOL_URI} for guided adapter creation`
    });
  }
  const memories = await runStore(() =>
    memoryStore.storeAdapter([docForStore], input.llm_model_id, {
      forceUpdate: !!input.force_update,
      ...(input.protocol_version && { protocolVersion: input.protocol_version }),
      ...(input.fork_new_adapter && { forkNewAdapter: true })
    })
  );
  return {
    items: memories.map((memory) => ({
      uri: `kairos://mem/${memory.memory_uuid}`,
      memory_uuid: memory.memory_uuid,
      label: memory.label,
      tags: memory.tags
    })),
    status: 'stored'
  };
}
