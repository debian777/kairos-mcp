import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import type { Memory } from '../../src/types/memory.js';

const nonceByUuid = new Map<string, string>();

jest.unstable_mockModule('../../src/services/proof-of-work-store.js', () => ({
  MAX_RETRIES: 3,
  proofOfWorkStore: {
    getNonce: async (uuid: string) => nonceByUuid.get(uuid) ?? null,
    setNonce: async (uuid: string, nonce: string) => {
      nonceByUuid.set(uuid, nonce);
    },
    getResult: async () => null,
    saveResult: async () => {},
    setProofHash: async () => {},
    getProofHash: async () => null,
    incrementRetry: async () => 1,
    resetRetry: async () => {}
  }
}));

jest.unstable_mockModule('../../src/services/forward-runtime-store.js', () => ({
  forwardRuntimeStore: {
    getExecution: async () => null,
    startExecution: async () => {},
    setTensor: async () => {},
    getTensor: async () => null,
    getTensorInputs: async () => ({}),
    requireTensorInputs: async () => ({}),
    deleteExecution: async () => {}
  }
}));

function makeCommentLayerMemory(memoryUuid: string): Memory {
  return {
    memory_uuid: memoryUuid,
    label: 'Test layer',
    tags: [],
    text: '# Step\n\nDo the thing.',
    llm_model_id: 'test',
    created_at: new Date().toISOString(),
    adapter: { id: 'adapter-head-uuid', name: 'Test adapter', layer_index: 5, layer_count: 5 },
    inference_contract: {
      type: 'comment',
      required: true,
      comment: { min_length: 10 }
    }
  };
}

describe('buildForwardView nonce stability', () => {
  let buildForwardView: typeof import('../../src/tools/forward-view.js').buildForwardView;

  beforeAll(async () => {
    const mod = await import('../../src/tools/forward-view.js');
    buildForwardView = mod.buildForwardView;
  });

  afterEach(() => {
    nonceByUuid.clear();
  });

  test('repeat forward preview for the same layer reuses the same nonce', async () => {
    const memoryUuid = randomUUID();
    const memory = makeCommentLayerMemory(memoryUuid);
    const executionId = randomUUID();

    const first = await buildForwardView(memory, executionId);
    const second = await buildForwardView(memory, executionId);

    expect(first.contract).toBeDefined();
    expect(second.contract).toBeDefined();
    if (
      typeof first.contract !== 'object' ||
      first.contract === null ||
      !('nonce' in first.contract) ||
      typeof first.contract.nonce !== 'string'
    ) {
      throw new Error('expected comment contract with nonce');
    }
    expect(second.contract).toMatchObject({ nonce: first.contract.nonce });
    expect(nonceByUuid.get(memoryUuid)).toBe(first.contract.nonce);
  });
});
