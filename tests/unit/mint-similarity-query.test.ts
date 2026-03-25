import { buildMintSimilaritySearchQuery } from '../../src/services/memory/store-chain-helpers.js';

describe('buildMintSimilaritySearchQuery', () => {
  test('joins chain and step with newline', () => {
    expect(buildMintSimilaritySearchQuery('My Protocol', 'Natural Language Triggers')).toBe(
      'My Protocol\nNatural Language Triggers'
    );
  });

  test('chain only when step empty', () => {
    expect(buildMintSimilaritySearchQuery('Solo chain', '  ')).toBe('Solo chain');
  });

  test('step only when chain empty', () => {
    expect(buildMintSimilaritySearchQuery('', 'First step')).toBe('First step');
  });

  test('both empty yields Memory', () => {
    expect(buildMintSimilaritySearchQuery(' ', '')).toBe('Memory');
  });
});
