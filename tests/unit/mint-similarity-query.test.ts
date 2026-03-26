import { buildAdapterSimilaritySearchQuery } from '../../src/services/memory/store-adapter-helpers.js';

describe('buildAdapterSimilaritySearchQuery', () => {
  test('joins adapter and layer with newline', () => {
    expect(buildAdapterSimilaritySearchQuery('My Protocol', 'Natural Language Triggers')).toBe(
      'My Protocol\nNatural Language Triggers'
    );
  });

  test('adapter only when layer empty', () => {
    expect(buildAdapterSimilaritySearchQuery('Solo adapter', '  ')).toBe('Solo adapter');
  });

  test('layer only when adapter empty', () => {
    expect(buildAdapterSimilaritySearchQuery('', 'First layer')).toBe('First layer');
  });

  test('both empty yields Memory', () => {
    expect(buildAdapterSimilaritySearchQuery(' ', '')).toBe('Memory');
  });
});
