/**
 * Unit tests for buildSpaceFilter (plan section 11).
 */

import { buildSpaceFilter } from '../../src/utils/space-filter.js';

describe('space-filter', () => {
  it('produces must clause with space_id any match', () => {
    const filter = buildSpaceFilter(['user:alice', 'group:team1']);
    expect(filter.must).toHaveLength(1);
    expect(filter.must![0]).toEqual({
      key: 'space_id',
      match: { any: ['user:alice', 'group:team1'] }
    });
  });

  it('merges with existing filter must array', () => {
    const existing = {
      must: [
        { key: 'domain', match: { value: 'general' } },
        { key: 'task', match: { value: 'search' } }
      ]
    };
    const filter = buildSpaceFilter(['space:default'], existing);
    expect(filter.must).toHaveLength(3);
    expect(filter.must![0]).toEqual({ key: 'space_id', match: { any: ['space:default'] } });
    expect(filter.must![1]).toEqual({ key: 'domain', match: { value: 'general' } });
    expect(filter.must![2]).toEqual({ key: 'task', match: { value: 'search' } });
  });

  it('handles undefined existing filter', () => {
    const filter = buildSpaceFilter(['user:u1']);
    expect(filter.must).toHaveLength(1);
    expect(filter.must![0].key).toBe('space_id');
  });

  it('handles existing filter with empty must', () => {
    const filter = buildSpaceFilter(['group:g1'], { must: [] });
    expect(filter.must).toHaveLength(1);
    expect(filter.must![0].key).toBe('space_id');
  });
});
