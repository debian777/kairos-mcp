import { describe, expect, test } from '@jest/globals';
import { effectiveChainStepCount, maxStepIndexFromChainPoints } from '../../src/services/chain-step-count.js';

describe('chain-step-count', () => {
  test('maxStepIndexFromChainPoints', () => {
    expect(
      maxStepIndexFromChainPoints([
        { payload: { chain: { step_index: 1 } } },
        { payload: { chain: { step_index: 3 } } },
        { payload: { chain: { step_index: 2 } } }
      ])
    ).toBe(3);
  });

  test('effectiveChainStepCount prefers larger of memory vs Qdrant points', () => {
    const points = [
      { payload: { chain: { step_index: 1 } } },
      { payload: { chain: { step_index: 2 } } },
      { payload: { chain: { step_index: 3 } } }
    ];
    expect(effectiveChainStepCount(points, 1)).toBe(3);
    expect(effectiveChainStepCount(points, 5)).toBe(5);
  });
});
