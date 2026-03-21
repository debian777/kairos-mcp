import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { validateProtocolStructure, CREATION_PROTOCOL_URI } from '../services/memory/validate-protocol-structure.js';
import type { MintInput, MintOutput } from './kairos_mint_schema.js';

/** Thrown by executeMint on validation or store errors. */
export class MintError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MintError';
  }
}

/**
 * Shared execute: validate and store markdown chain. Used by MCP tool and HTTP route.
 * @param runStore Runs the store call (e.g. with space context). Signature: (fn: () => Promise<Memory[]>) => Promise<Memory[]>
 */
export async function executeMint(
  memoryStore: MemoryQdrantStore,
  input: MintInput,
  runStore: (fn: () => Promise<Memory[]>) => Promise<Memory[]>
): Promise<MintOutput> {
  const validation = validateProtocolStructure(input.markdown_doc);
  if (!validation.valid) {
    throw new MintError('PROTOCOL_STRUCTURE_INVALID', validation.message, {
      missing: validation.missing,
      must_obey: true,
      next_action: `call kairos_begin with ${CREATION_PROTOCOL_URI} for guided protocol creation`
    });
  }
  const memories = await runStore(() =>
    memoryStore.storeChain([input.markdown_doc], input.llm_model_id, {
      forceUpdate: !!input.force_update,
      ...(input.protocol_version && { protocolVersion: input.protocol_version })
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
