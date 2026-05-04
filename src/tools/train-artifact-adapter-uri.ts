import type { QdrantService } from '../services/qdrant/service.js';
import { assertWireAdapterUri, buildAdapterUri, parseKairosUri } from './kairos-uri.js';
import { TrainError } from './train-store.js';

export async function resolveCanonicalAdapterUriForArtifact(
  inputAdapterUri: string | undefined,
  qdrantService: QdrantService | undefined
): Promise<string | undefined> {
  const raw = typeof inputAdapterUri === 'string' ? inputAdapterUri.trim() : '';
  if (!raw) return undefined;

  let parsed: ReturnType<typeof parseKairosUri>;
  try {
    parsed = parseKairosUri(assertWireAdapterUri(raw));
  } catch {
    throw new TrainError('INVALID_ADAPTER_URI', 'adapter_uri must be kairos://adapter/{slug}', {
      must_obey: true
    });
  }

  if (!qdrantService) {
    throw new TrainError(
      'ADAPTER_LOOKUP_UNAVAILABLE',
      'adapter_uri slug resolution requires adapter storage service availability.',
      { must_obey: true }
    );
  }

  const resolved = await qdrantService.findFirstStepMemoryUuidBySlug(parsed.id);
  if (!resolved.layerUuid) {
    throw new TrainError('ADAPTER_NOT_FOUND', `adapter_uri adapter slug "${parsed.id}" was not found.`, {
      must_obey: true
    });
  }
  return buildAdapterUri(resolved.layerUuid);
}
