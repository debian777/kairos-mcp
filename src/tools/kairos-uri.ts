import { KairosError } from '../types/index.js';
import { normalizeAuthorSlug } from '../utils/protocol-slug.js';

const UUID_PATTERN = '[0-9a-f-]{36}';
const SLUG_PATTERN = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';

const UUID_REGEX = new RegExp(`^${UUID_PATTERN}$`, 'i');
const ADAPTER_URI_BODY_REGEX = /^kairos:\/\/adapter\/([^/?#]+)$/i;
const ARTIFACT_URI_BODY_REGEX = /^kairos:\/\/artifact\/([^/?#]+)$/i;
export const ADAPTER_SLUG_URI_INPUT_REGEX = new RegExp(
  `^kairos://adapter/(${UUID_PATTERN}|${SLUG_PATTERN})$`,
  'i'
);
export const ARTIFACT_URI_INPUT_REGEX = new RegExp(
  `^kairos://artifact/(${UUID_PATTERN}|${SLUG_PATTERN})$`,
  'i'
);
export const LAYER_URI_INPUT_REGEX = new RegExp(
  `^kairos://layer/(${UUID_PATTERN})(?:\\?execution_id=([0-9a-f-]{36}))?$`,
  'i'
);

export type ParsedKairosUri =
  | { kind: 'adapter'; id: string; idKind: 'uuid' | 'slug'; raw: string }
  | { kind: 'artifact'; id: string; idKind: 'uuid' | 'slug'; raw: string }
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

  /** Transitional input only: older ambiguous surface that meant a layer row UUID. */
  const olderLayerRowPrefix = ['kairos', '://', 'me', 'm', '/'].join('');
  if (normalized.startsWith(olderLayerRowPrefix)) {
    const rest = normalized.slice(olderLayerRowPrefix.length).split('?')[0] ?? '';
    const id = rest.split('/')[0] ?? '';
    if (UUID_REGEX.test(id)) {
      return { kind: 'layer', id, raw: normalized };
    }
  }

  const artifactMatch = normalized.match(ARTIFACT_URI_BODY_REGEX);
  if (artifactMatch?.[1]) {
    if (UUID_REGEX.test(artifactMatch[1])) {
      return {
        kind: 'artifact',
        id: artifactMatch[1],
        idKind: 'uuid',
        raw: normalized
      };
    }

    const normalizedSlug = normalizeAuthorSlug(artifactMatch[1]);
    if (normalizedSlug) {
      return {
        kind: 'artifact',
        id: normalizedSlug,
        idKind: 'slug',
        raw: normalized
      };
    }
  }

  throw new Error(
    'Invalid KAIROS URI. Expected kairos://adapter/{uuid|slug}, kairos://artifact/{uuid|slug}, kairos://layer/{uuid}[?execution_id=…], or the transitional older layer-row form'
  );
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

/**
 * Wire contract guard for public tool inputs: validates adapter URI format.
 */
export function assertWireAdapterUri(value: string): string {
  const parsed = parseKairosUri(value);
  if (parsed.kind !== 'adapter') {
    throw new KairosError(
      'Invalid adapter URI. Expected kairos://adapter/{slug}.',
      'INVALID_URI',
      400
    );
  }
  return buildAdapterUri(parsed.id);
}
