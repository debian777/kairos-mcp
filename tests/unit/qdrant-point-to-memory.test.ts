import { pointToMemory } from '../../src/services/memory/qdrant-point-to-memory.js';

describe('pointToMemory', () => {
  test('keeps activation patterns nested on adapter only', () => {
    const memory = pointToMemory({
      id: '00000000-0000-0000-0000-000000000111',
      payload: {
        label: 'Deploy Service',
        text: 'Deploy the service safely.',
        llm_model_id: 'test-model',
        created_at: '2026-03-26T00:00:00.000Z',
        activation_patterns: ['stale top-level'],
        adapter: {
          id: '00000000-0000-0000-0000-000000000111',
          name: 'Deploy Service',
          layer_index: 1,
          layer_count: 2,
          activation_patterns: ['nested canonical']
        }
      }
    });

    expect(memory.adapter?.activation_patterns).toEqual(['nested canonical']);
    expect('activation_patterns' in memory).toBe(false);
    expect(Object.keys(memory).sort()).toEqual([
      'adapter',
      'created_at',
      'label',
      'llm_model_id',
      'memory_uuid',
      'space_id',
      'tags',
      'text'
    ]);
  });

  test('maps older-format completion_rule adapter field into reward_signal heading', () => {
    const memory = pointToMemory({
      id: '00000000-0000-0000-0000-000000000112',
      payload: {
        label: 'Compose',
        text: 'Compose workflow content.',
        llm_model_id: 'test-model',
        created_at: '2026-03-30T00:00:00.000Z',
        adapter: {
          id: '00000000-0000-0000-0000-000000000112',
          name: 'Compose',
          layer_index: 1,
          layer_count: 3,
          completion_rule: 'Protocol is complete when all review checks pass.'
        }
      }
    });

    expect(memory.adapter?.reward_signal).toBe(
      '## Completion Rule\n\nProtocol is complete when all review checks pass.'
    );
  });

  test('preserves canonical reward_signal without rewriting heading', () => {
    const memory = pointToMemory({
      id: '00000000-0000-0000-0000-000000000113',
      payload: {
        label: 'Compose',
        text: 'Compose workflow content.',
        llm_model_id: 'test-model',
        created_at: '2026-03-30T00:00:00.000Z',
        adapter: {
          id: '00000000-0000-0000-0000-000000000113',
          name: 'Compose',
          layer_index: 1,
          layer_count: 3,
          reward_signal: '## Reward Signal\n\nAll done when checks are green.'
        }
      }
    });

    expect(memory.adapter?.reward_signal).toBe('## Reward Signal\n\nAll done when checks are green.');
  });
});
