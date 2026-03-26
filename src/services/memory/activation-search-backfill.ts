import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../../utils/structured-logger.js';
import {
  getActivationPatternVectorName,
  getAdapterTitleVectorName,
} from '../../utils/qdrant-utils.js';
import { embeddingService } from '../embedding/service.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildActivationSearchFields } from './activation-search-fields.js';
import {
  normalizeActivationPatternPayload,
  normalizeActivationPatternStringArray,
} from './activation-pattern-payload.js';

export async function backfillActivationSearchVectors(
  client: QdrantClient,
  collection: string,
  vectorSize: number
): Promise<void> {
  const titleVectorName = getAdapterTitleVectorName(vectorSize);
  const activationPatternVectorName =
    getActivationPatternVectorName(vectorSize);
  const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds);
  let offset: string | number | null | undefined = undefined;
  let updatedPoints = 0;

  do {
    const page = await client.scroll(
      collection,
      {
        filter,
        with_payload: true,
        with_vector: true,
        limit: 64,
        ...(offset != null ? { offset } : {}),
      } as never
    );
    const points = page.points ?? [];
    if (points.length === 0) {
      break;
    }

    const pending = points
      .map((point) => {
        const payload = (point.payload ?? {}) as any;
        const normalizedPayload = normalizeActivationPatternPayload(payload as Record<string, unknown>);
        const adapter = (normalizedPayload.payload['adapter'] ?? {}) as any;
        const fields = buildActivationSearchFields({
          adapterName:
            (typeof adapter.name === 'string' && adapter.name) ||
            (typeof payload.label === 'string' && payload.label) ||
            'Knowledge Adapter',
          label: typeof payload.label === 'string' ? payload.label : 'Memory',
          text: typeof payload.text === 'string' ? payload.text : '',
          tags: normalizeActivationPatternStringArray(payload.tags),
          activationPatterns: normalizedPayload.canonicalPatterns,
        });
        const vector =
          point.vector && typeof point.vector === 'object' && !Array.isArray(point.vector)
            ? (point.vector as Record<string, unknown>)
            : {};
        const payloadNeedsUpdate =
          normalizedPayload.changed ||
          payload.adapter_name_text !== fields.adapterNameText ||
          payload.label_text !== fields.labelText ||
          payload.activation_patterns_text !==
            fields.activationPatternsText ||
          payload.tags_text !== fields.tagsText;
        const missingTitleVector = !Array.isArray(vector[titleVectorName]);
        const missingActivationPatternVector = !Array.isArray(
          vector[activationPatternVectorName]
        );
        if (
          !payloadNeedsUpdate &&
          !missingTitleVector &&
          !missingActivationPatternVector
        ) {
          return null;
        }
        return { point, payload, vector, fields, normalizedPayload: normalizedPayload.payload };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (pending.length > 0) {
      const embeddingBatch = await embeddingService.generateBatchEmbeddings(
        pending.flatMap(({ fields }) => [
          fields.titleDenseText,
          fields.activationPatternDenseText,
        ])
      );
      const updates = pending.map(({ point, normalizedPayload, vector, fields }, index) => ({
        id: point.id,
        vector: {
          ...vector,
          [titleVectorName]: embeddingBatch.embeddings[index * 2]!,
          [activationPatternVectorName]:
            embeddingBatch.embeddings[index * 2 + 1]!,
        },
        payload: {
          ...normalizedPayload,
          adapter_name_text: fields.adapterNameText,
          label_text: fields.labelText,
          activation_patterns_text: fields.activationPatternsText,
          tags_text: fields.tagsText,
        },
      }));
      await client.upsert(collection, { points: updates, wait: true } as never);
      updatedPoints += updates.length;
    }

    const next = page.next_page_offset;
    offset = typeof next === 'string' || typeof next === 'number' ? next : undefined;
  } while (offset !== undefined);

  if (updatedPoints > 0) {
    logger.info(
      `[MemoryQdrantStore] Backfilled activation search vectors and payload fields for ${updatedPoints} point(s)`
    );
  }
}
