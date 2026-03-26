import { KairosError } from '../types/index.js';
import { normalizeAuthorSlug } from '../utils/protocol-slug.js';

const UUID_PATTERN = '[0-9a-f-]{36}';
const SLUG_PATTERN = '[a-z0-9]+(?:-[a-z0-9]+)*';

const UUID_REGEX = new RegExp(`^${UUID_PATTERN}$`, 'i');
const ADAPTER_URI_BODY_REGEX = /^kairos:\/\/adapter\/([^/?#]+)$/i;
export const ADAPTER_URI_INPUT_REGEX = new RegExp(
  `^kairos://adapter/(${UUID_PATTERN}|${SLUG_PATTERN})$`,
  'i'
);
export const LAYER_URI_INPUT_REGEX = new RegExp(
  `^kairos://layer/(${UUID_PATTERN})(?:\\?execution_id=([0-9a-f-]{36}))?$`,
  'i'
);

export type ParsedKairosUri =
  | { kind: 'adapter'; id: string; idKind: 'uuid' | 'slug'; raw: string }
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

  const adapterMatch = normalized.match(ADAPTER_URI_BODY_REGEX);
  if (adapterMatch?.[1]) {
    if (UUID_REGEX.test(adapterMatch[1])) {
      return {
        kind: 'adapter',
        id: adapterMatch[1],
        idKind: 'uuid',
        raw: normalized
      };
    }

    const normalizedSlug = normalizeAuthorSlug(adapterMatch[1]);
    if (normalizedSlug) {
      return {
        kind: 'adapter',
        id: normalizedSlug,
        idKind: 'slug',
        raw: normalized
      };
    }
  }

  const layerMatch = normalized.match(LAYER_URI_INPUT_REGEX);
  if (layerMatch?.[1]) {
    return {
      kind: 'layer',
      id: layerMatch[1],
      ...(layerMatch[2] ? { executionId: layerMatch[2] } : {}),
      raw: normalized
    };
  }

  throw new Error('Invalid KAIROS URI. Expected kairos://adapter/{uuid|slug} or kairos://layer/{uuid}');
}

export function parseKairosUriOrThrow(value: string): ParsedKairosUri {
  try {
    return parseKairosUri(value);
  } catch (error) {
    throw new KairosError(
      error instanceof Error ? error.message : 'Invalid KAIROS URI.',
      'INVALID_URI',
      400
    );
  }
}
