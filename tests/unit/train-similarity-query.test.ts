import { buildAdapterSimilaritySearchQuery } from '../../src/services/memory/store-adapter-helpers.js';

describe('buildAdapterSimilaritySearchQuery', () => {
  test('uses adapter title only', () => {
    expect(buildAdapterSimilaritySearchQuery('My Protocol')).toBe('My Protocol');
  });

  test('ignores extra whitespace', () => {
    expect(buildAdapterSimilaritySearchQuery('  Solo adapter  ')).toBe('Solo adapter');
  });

  test('empty or blank yields Memory', () => {
    expect(buildAdapterSimilaritySearchQuery('')).toBe('Memory');
    expect(buildAdapterSimilaritySearchQuery('   ')).toBe('Memory');
  });
});
