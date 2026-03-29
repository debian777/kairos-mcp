import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { validateProtocolStructure, CREATION_PROTOCOL_URI } from '../services/memory/validate-protocol-structure.js';
import type { TrainStoreInput, TrainStoreOutput } from './train_schema.js';

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
  const validation = validateProtocolStructure(input.markdown_doc);
  if (!validation.valid) {
    throw new TrainError('PROTOCOL_STRUCTURE_INVALID', validation.message, {
      missing: validation.missing,
      must_obey: true,
      next_action: `call forward with ${CREATION_PROTOCOL_URI} for guided adapter creation`
    });
  }
  const memories = await runStore(() =>
    memoryStore.storeAdapter([input.markdown_doc], input.llm_model_id, {
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
