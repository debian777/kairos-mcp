const UUID_PATTERN = '[0-9a-f-]{36}';

const ADAPTER_URI_REGEX = new RegExp(`^kairos://adapter/(${UUID_PATTERN})$`, 'i');
const LAYER_URI_REGEX = new RegExp(
  `^kairos://layer/(${UUID_PATTERN})(?:\\?execution_id=([0-9a-f-]{36}))?$`,
  'i'
);
const LEGACY_MEMORY_URI_REGEX = new RegExp(`^kairos://mem/(${UUID_PATTERN})$`, 'i');

export type ParsedKairosUri =
  | { kind: 'adapter'; id: string; raw: string }
  | { kind: 'layer'; id: string; executionId?: string; raw: string };

export function buildAdapterUri(adapterId: string): string {
  return `kairos://adapter/${adapterId}`;
}

export function buildLayerUri(layerId: string, executionId?: string): string {
  return executionId
    ? `kairos://layer/${layerId}?execution_id=${executionId}`
    : `kairos://layer/${layerId}`;
}

export function parseKairosUri(value: string): ParsedKairosUri {
  const normalized = (value || '').trim();

  const adapterMatch = normalized.match(ADAPTER_URI_REGEX);
  if (adapterMatch?.[1]) {
    return {
      kind: 'adapter',
      id: adapterMatch[1],
      raw: normalized
    };
  }

  const layerMatch = normalized.match(LAYER_URI_REGEX);
  if (layerMatch?.[1]) {
    return {
      kind: 'layer',
      id: layerMatch[1],
      ...(layerMatch[2] ? { executionId: layerMatch[2] } : {}),
      raw: normalized
    };
  }

  const legacyMatch = normalized.match(LEGACY_MEMORY_URI_REGEX);
  if (legacyMatch?.[1]) {
    return {
      kind: 'layer',
      id: legacyMatch[1],
      raw: normalized
    };
  }

  throw new Error('Invalid KAIROS URI. Expected kairos://adapter/{uuid} or kairos://layer/{uuid}');
}

