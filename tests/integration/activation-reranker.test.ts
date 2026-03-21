import { scoreActivationRerank } from '../../src/services/memory/activation-reranker.js';
import type { Memory } from '../../src/types/memory.js';

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    memory_uuid: '11111111-1111-1111-1111-111111111111',
    label: 'Ship release adapter',
    tags: ['release', 'deploy'],
    text: 'Adapter content',
    llm_model_id: 'test-model',
    created_at: new Date().toISOString(),
    adapter: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Ship release',
      layer_index: 1,
      layer_count: 1,
      activation_patterns: ['cut a release', 'publish a release candidate']
    },
    activation_patterns: ['cut a release', 'publish a release candidate'],
    ...overrides
  };
}

describe('activation reranker', () => {
  test('rewards direct activation pattern matches over unrelated intents', () => {
    const memory = makeMemory();

    const strongMatch = scoreActivationRerank('cut a release', memory);
    const weakMatch = scoreActivationRerank('rotate database credentials', memory);

    expect(strongMatch).toBeGreaterThan(weakMatch);
    expect(strongMatch).toBeGreaterThan(0);
  });

  test('uses adapter labels, tags, and activation patterns together', () => {
    const memory = makeMemory({
      label: 'Deploy release candidate',
      tags: ['release', 'candidate']
    });

    const score = scoreActivationRerank('release candidate', memory);

    expect(score).toBeGreaterThan(0.2);
  });
});
