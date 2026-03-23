import crypto from 'node:crypto';
import type { Memory, InferenceContractDefinition } from '../../types/memory.js';
import { KAIROS_APP_SPACE_ID } from '../../config.js';

type QdrantPointLike = {
  id?: string | number | null;
  payload?: Record<string, unknown> | null;
};

export function pointToMemory(point: QdrantPointLike): Memory {
  const payload = (point.payload ?? {}) as any;
  const memoryUuid = point.id ? String(point.id) : crypto.randomUUID();
  const base: any = {
    memory_uuid: memoryUuid,
    ...(typeof payload.space_id === 'string' &&
      payload.space_id.length > 0 && { space_id: payload.space_id }),
    label:
      typeof payload.label === 'string' && payload.label.length > 0
        ? payload.label
        : 'Memory',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    text: typeof payload.text === 'string' ? payload.text : '',
    llm_model_id:
      typeof payload.llm_model_id === 'string'
        ? payload.llm_model_id
        : 'unknown-model',
    created_at:
      typeof payload.created_at === 'string'
        ? payload.created_at
        : new Date().toISOString(),
  };

  const payloadAdapter: any =
    payload.adapter && typeof (payload.adapter as { id?: unknown }).id === 'string'
      ? payload.adapter
      : payload.chain && typeof (payload.chain as { id?: unknown }).id === 'string'
        ? {
            id: payload.chain.id,
            name: payload.chain.label,
            layer_index: payload.chain.step_index,
            layer_count: payload.chain.step_count,
            protocol_version: payload.chain.protocol_version,
            activation_patterns: payload.chain.activation_patterns,
          }
        : typeof payload.memory_chain_id === 'string'
          ? {
              id: payload.memory_chain_id,
              name:
                typeof payload.chain_label === 'string'
                  ? payload.chain_label
                  : 'Knowledge Adapter',
              layer_index:
                typeof payload.chain_step_index === 'number'
                  ? payload.chain_step_index
                  : 1,
              layer_count:
                typeof payload.chain_step_count === 'number'
                  ? payload.chain_step_count
                  : 1,
            }
          : null;

  if (payloadAdapter) {
    const adapter = {
      id: payloadAdapter.id,
      name:
        typeof payloadAdapter.name === 'string'
          ? payloadAdapter.name
          : typeof payloadAdapter.label === 'string'
            ? payloadAdapter.label
            : 'Knowledge Adapter',
      layer_index:
        typeof payloadAdapter.layer_index === 'number'
          ? payloadAdapter.layer_index
          : typeof payloadAdapter.step_index === 'number'
            ? payloadAdapter.step_index
            : 1,
      layer_count:
        typeof payloadAdapter.layer_count === 'number'
          ? payloadAdapter.layer_count
          : typeof payloadAdapter.step_count === 'number'
            ? payloadAdapter.step_count
            : 1,
      ...(typeof payloadAdapter.protocol_version === 'string' && {
        protocol_version: payloadAdapter.protocol_version,
      }),
      ...(Array.isArray(payloadAdapter.activation_patterns) && {
        activation_patterns: payloadAdapter.activation_patterns,
      }),
    };

    base.adapter = adapter;
    base.chain = {
      id: adapter.id,
      label: adapter.name,
      step_index: adapter.layer_index,
      step_count: adapter.layer_count,
      ...(adapter.protocol_version && {
        protocol_version: adapter.protocol_version,
      }),
      ...(adapter.activation_patterns && {
        activation_patterns: adapter.activation_patterns,
      }),
    };
    base.activation_patterns = adapter.activation_patterns ?? [];
  }

  const payloadContract: any =
    payload.inference_contract &&
    typeof payload.inference_contract === 'object'
      ? payload.inference_contract
      : payload.proof_of_work && typeof payload.proof_of_work === 'object'
        ? payload.proof_of_work
        : null;

  if (payloadContract) {
    if (typeof payloadContract.cmd === 'string') {
      base.inference_contract = {
        cmd: payloadContract.cmd,
        timeout_seconds:
          typeof payloadContract.timeout_seconds === 'number'
            ? payloadContract.timeout_seconds
            : 60,
        required: Boolean(payloadContract.required),
      };
    } else {
      base.inference_contract =
        payloadContract as unknown as InferenceContractDefinition;
    }
    base.proof_of_work = base.inference_contract;
  }

  const pointSpaceId =
    typeof payload.space_id === 'string' && payload.space_id.length > 0
      ? payload.space_id
      : KAIROS_APP_SPACE_ID;
  if (!('space_id' in base) && pointSpaceId) {
    base.space_id = pointSpaceId;
  }

  return base as unknown as Memory;
}
