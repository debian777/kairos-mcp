import { describe, expect, jest, test } from '@jest/globals';
import { checkSimilarAdapterByTitle } from '../../src/services/memory/store-adapter-helpers.js';
import type { Memory } from '../../src/types/memory.js';

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    memory_uuid: '11111111-1111-4111-8111-111111111111',
    label: 'Activation Patterns',
    tags: [],
    text: 'Existing adapter body',
    llm_model_id: 'test-model',
    created_at: new Date().toISOString(),
    adapter: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Existing Adapter',
      layer_index: 1,
      layer_count: 2
    },
    ...overrides
  };
}

describe('checkSimilarAdapterByTitle', () => {
  test('uses dedicated title similarity search instead of hybrid ranking scores', async () => {
    const searchMemories = jest.fn(async () => ({
      memories: [makeMemory()],
      scores: [1.18]
    }));
    const searchAdapterTitlesBySimilarity = jest.fn(async () => ({
      memories: [makeMemory()],
      scores: [0.41]
    }));

    await expect(
      checkSimilarAdapterByTitle(
        {
          searchMemories,
          searchAdapterTitlesBySimilarity
        } as any,
        'Obsidian Vault - Find, Read, Edit, Create Notes via MCP',
        false
      )
    ).resolves.toBeUndefined();

    expect(searchAdapterTitlesBySimilarity).toHaveBeenCalledTimes(1);
    expect(searchMemories).not.toHaveBeenCalled();
  });

  test('throws SIMILAR_MEMORY_FOUND when title cosine similarity crosses threshold', async () => {
    const searchAdapterTitlesBySimilarity = jest.fn(async () => ({
      memories: [makeMemory()],
      scores: [0.95]
    }));

    await expect(
      checkSimilarAdapterByTitle(
        { searchAdapterTitlesBySimilarity } as any,
        'Existing Adapter',
        false
      )
    ).rejects.toMatchObject({
      code: 'SIMILAR_MEMORY_FOUND',
      details: expect.objectContaining({
        similarity_score: 0.95,
        existing_memory: expect.objectContaining({
          adapter_name: 'Existing Adapter'
        })
      })
    });
  });

  test('preserves force_update bypass', async () => {
    const searchAdapterTitlesBySimilarity = jest.fn();

    await expect(
      checkSimilarAdapterByTitle(
        { searchAdapterTitlesBySimilarity } as any,
        'Force Updated Adapter',
        true
      )
    ).resolves.toBeUndefined();

    expect(searchAdapterTitlesBySimilarity).not.toHaveBeenCalled();
  });
});
