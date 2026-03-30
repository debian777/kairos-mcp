import { extractAdapterRewardSignal } from '../../src/utils/reward-signal.js';

describe('extractAdapterRewardSignal', () => {
  test('prefers canonical reward_signal when present', () => {
    expect(
      extractAdapterRewardSignal({
        reward_signal: '## Reward Signal\n\nCanonical reward text.',
        completion_rule: 'older-format text'
      })
    ).toBe('## Reward Signal\n\nCanonical reward text.');
  });

  test('normalizes completion_rule body into heading section', () => {
    expect(
      extractAdapterRewardSignal({
        completion_rule: 'Publish URL returned and user acknowledged.'
      })
    ).toBe('## Completion Rule\n\nPublish URL returned and user acknowledged.');
  });

  test('returns undefined when no known reward fields exist', () => {
    expect(
      extractAdapterRewardSignal({
        id: 'x',
        name: 'Adapter'
      })
    ).toBeUndefined();
  });
});

