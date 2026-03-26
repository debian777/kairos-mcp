import { normalizeActivationPatternPayload } from '../../src/services/memory/activation-pattern-payload.js';

describe('normalizeActivationPatternPayload', () => {
  test('moves top-level activation patterns into the canonical adapter payload', () => {
    const result = normalizeActivationPatternPayload({
      activation_patterns: ['deploy service'],
      adapter: {
        id: 'adapter-1',
        name: 'Deploy Service',
        layer_index: 1,
        layer_count: 1
      }
    });

    expect(result.changed).toBe(true);
    expect(result.canonicalPatterns).toEqual(['deploy service']);
    expect(result.payload).not.toHaveProperty('activation_patterns');
    expect((result.payload['adapter'] as { activation_patterns?: string[] }).activation_patterns).toEqual([
      'deploy service'
    ]);
  });

  test('keeps nested adapter patterns as the source of truth when top-level differs', () => {
    const result = normalizeActivationPatternPayload({
      activation_patterns: ['stale top-level'],
      adapter: {
        id: 'adapter-1',
        name: 'Deploy Service',
        layer_index: 1,
        layer_count: 1,
        activation_patterns: ['nested canonical']
      }
    });

    expect(result.canonicalPatterns).toEqual(['nested canonical']);
    expect((result.payload['adapter'] as { activation_patterns?: string[] }).activation_patterns).toEqual([
      'nested canonical'
    ]);
    expect(result.payload).not.toHaveProperty('activation_patterns');
  });

  test('keeps canonical adapter payload fields unchanged', () => {
    const result = normalizeActivationPatternPayload({
      adapter: {
        id: 'adapter-2',
        name: 'Earlier Deploy Service',
        layer_index: 2,
        layer_count: 4,
        activation_patterns: ['canonical']
      }
    });

    expect(result.changed).toBe(false);
    expect(result.payload['adapter']).toEqual({
      id: 'adapter-2',
      name: 'Earlier Deploy Service',
      layer_index: 2,
      layer_count: 4,
      activation_patterns: ['canonical']
    });
  });
});
