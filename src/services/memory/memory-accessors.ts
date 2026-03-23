import type { AdapterInfo, InferenceContractDefinition, Memory } from '../../types/memory.js';

export function getAdapterInfo(memory: Pick<Memory, 'adapter' | 'chain' | 'memory_uuid' | 'label'>): AdapterInfo | undefined {
  if (memory.adapter) {
    return memory.adapter;
  }
  if (memory.chain) {
    return {
      id: memory.chain.id,
      name: memory.chain.label,
      layer_index: memory.chain.step_index,
      layer_count: memory.chain.step_count,
      ...(memory.chain.protocol_version && { protocol_version: memory.chain.protocol_version }),
      ...(memory.chain.activation_patterns && { activation_patterns: memory.chain.activation_patterns })
    };
  }
  return undefined;
}

export function getAdapterId(memory: Pick<Memory, 'adapter' | 'chain' | 'memory_uuid' | 'label'>): string {
  return getAdapterInfo(memory)?.id ?? memory.memory_uuid;
}

export function getAdapterName(memory: Pick<Memory, 'adapter' | 'chain' | 'memory_uuid' | 'label'>): string {
  return getAdapterInfo(memory)?.name ?? memory.label;
}

export function getActivationPatterns(memory: Pick<Memory, 'activation_patterns' | 'adapter' | 'chain' | 'memory_uuid' | 'label'>): string[] {
  return memory.activation_patterns ?? getAdapterInfo(memory)?.activation_patterns ?? [];
}

export function getLayerIndex(memory: Pick<Memory, 'adapter' | 'chain' | 'memory_uuid' | 'label'>): number {
  return getAdapterInfo(memory)?.layer_index ?? 1;
}

export function getLayerCount(memory: Pick<Memory, 'adapter' | 'chain' | 'memory_uuid' | 'label'>): number {
  return getAdapterInfo(memory)?.layer_count ?? 1;
}

export function getInferenceContract(memory: Pick<Memory, 'inference_contract' | 'proof_of_work'>): InferenceContractDefinition | undefined {
  return memory.inference_contract ?? memory.proof_of_work;
}
