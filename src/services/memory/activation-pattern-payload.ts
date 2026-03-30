export function normalizeActivationPatternStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0
      )
    : [];
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildCanonicalAdapterPayload(
  payload: Record<string, unknown>,
  canonicalPatterns: string[]
): Record<string, unknown> | undefined {
  const adapter = (payload['adapter'] ?? {}) as Record<string, unknown>;
  const id = typeof adapter['id'] === 'string' ? adapter['id'] : undefined;

  if (!id) {
    return undefined;
  }

  const name =
    typeof adapter['name'] === 'string' && adapter['name'].trim().length > 0
      ? adapter['name']
      : 'Knowledge Adapter';

  const layerIndex =
    typeof adapter['layer_index'] === 'number'
      ? adapter['layer_index']
      : 1;

  const layerCount =
    typeof adapter['layer_count'] === 'number'
      ? adapter['layer_count']
      : 1;

  const protocolVersion =
    typeof adapter['protocol_version'] === 'string'
      ? adapter['protocol_version']
      : undefined;

  const passthroughEntries = Object.entries(adapter).filter(
    ([key]) =>
      !['id', 'name', 'layer_index', 'layer_count', 'protocol_version', 'activation_patterns'].includes(key)
  );
  const passthroughAdapterFields = Object.fromEntries(passthroughEntries);

  return {
    ...passthroughAdapterFields,
    id,
    name,
    layer_index: layerIndex,
    layer_count: layerCount,
    ...(protocolVersion && { protocol_version: protocolVersion }),
    ...(canonicalPatterns.length > 0 && { activation_patterns: canonicalPatterns })
  };
}

function sameAdapterPayload(
  currentAdapter: unknown,
  canonicalAdapter: Record<string, unknown>
): boolean {
  if (!currentAdapter || typeof currentAdapter !== 'object' || Array.isArray(currentAdapter)) {
    return false;
  }

  const current = currentAdapter as Record<string, unknown>;
  return (
    current['id'] === canonicalAdapter['id'] &&
    current['name'] === canonicalAdapter['name'] &&
    current['layer_index'] === canonicalAdapter['layer_index'] &&
    current['layer_count'] === canonicalAdapter['layer_count'] &&
    current['protocol_version'] === canonicalAdapter['protocol_version'] &&
    sameStringArray(
      normalizeActivationPatternStringArray(current['activation_patterns']),
      normalizeActivationPatternStringArray(canonicalAdapter['activation_patterns'])
    )
  );
}

export function resolveCanonicalActivationPatterns(payload: Record<string, unknown>): string[] {
  const adapter = (payload['adapter'] ?? {}) as Record<string, unknown>;
  const payloadActivationPatterns = normalizeActivationPatternStringArray(payload['activation_patterns']);
  const adapterActivationPatterns = normalizeActivationPatternStringArray(adapter['activation_patterns']);

  if (adapterActivationPatterns.length > 0) {
    return adapterActivationPatterns;
  }
  return payloadActivationPatterns;
}

export function normalizeActivationPatternPayload(payload: Record<string, unknown>): {
  payload: Record<string, unknown>;
  changed: boolean;
  canonicalPatterns: string[];
} {
  const canonicalPatterns = resolveCanonicalActivationPatterns(payload);
  const nextPayload: Record<string, unknown> = { ...payload };
  let changed = false;
  const canonicalAdapter = buildCanonicalAdapterPayload(payload, canonicalPatterns);

  if ('activation_patterns' in nextPayload) {
    delete nextPayload['activation_patterns'];
    changed = true;
  }

  if (canonicalAdapter && !sameAdapterPayload(nextPayload['adapter'], canonicalAdapter)) {
    nextPayload['adapter'] = canonicalAdapter;
    changed = true;
  }

  if (canonicalPatterns.length === 0) {
    return { payload: nextPayload, changed, canonicalPatterns };
  }

  const adapter = nextPayload['adapter'];
  if (adapter && typeof adapter === 'object' && !Array.isArray(adapter)) {
    const current = normalizeActivationPatternStringArray((adapter as Record<string, unknown>)['activation_patterns']);
    if (!sameStringArray(current, canonicalPatterns)) {
      nextPayload['adapter'] = {
        ...(adapter as Record<string, unknown>),
        activation_patterns: canonicalPatterns
      };
      changed = true;
    }
  }

  return { payload: nextPayload, changed, canonicalPatterns };
}
