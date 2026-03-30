function normalizeRewardSection(raw: string, heading: 'Reward Signal' | 'Completion Rule'): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/^##\s+/m.test(trimmed)) {
    return trimmed;
  }
  return `## ${heading}\n\n${trimmed}`;
}

/**
 * Read adapter reward markdown from canonical and older-format payload keys.
 * Keeps export resilient for older stored payload shapes.
 */
export function extractAdapterRewardSignal(
  adapter: Record<string, unknown>
): string | undefined {
  const canonical = adapter['reward_signal'];
  if (typeof canonical === 'string') {
    return normalizeRewardSection(canonical, 'Reward Signal');
  }

  const camel = adapter['rewardSignal'];
  if (typeof camel === 'string') {
    return normalizeRewardSection(camel, 'Reward Signal');
  }

  const completionSnake = adapter['completion_rule'];
  if (typeof completionSnake === 'string') {
    return normalizeRewardSection(completionSnake, 'Completion Rule');
  }

  const completionCamel = adapter['completionRule'];
  if (typeof completionCamel === 'string') {
    return normalizeRewardSection(completionCamel, 'Completion Rule');
  }

  return undefined;
}

