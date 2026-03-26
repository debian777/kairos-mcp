import { describe, expect, test } from '@jest/globals';
import { effectiveAdapterLayerCount, maxLayerIndexFromAdapterPoints } from '../../src/services/adapter-layer-count.js';

describe('adapter-layer-count', () => {
  test('maxLayerIndexFromAdapterPoints uses adapter.layer_index for current payloads', () => {
    expect(
      maxLayerIndexFromAdapterPoints([
        { payload: { adapter: { layer_index: 1 } } },
        { payload: { adapter: { layer_index: 3 } } },
        { payload: { adapter: { layer_index: 2 } } }
      ])
    ).toBe(3);
  });

  test('maxLayerIndexFromAdapterPoints ignores points without adapter.layer_index', () => {
    expect(
      maxLayerIndexFromAdapterPoints([
        { payload: {} },
        { payload: { adapter: {} } }
      ])
    ).toBe(0);
  });

  test('effectiveAdapterLayerCount prefers larger of memory vs Qdrant points', () => {
    const points = [
      { payload: { adapter: { layer_index: 1 } } },
      { payload: { adapter: { layer_index: 2 } } },
      { payload: { adapter: { layer_index: 3 } } }
    ];
    expect(effectiveAdapterLayerCount(points, 1)).toBe(3);
    expect(effectiveAdapterLayerCount(points, 5)).toBe(5);
  });
});
