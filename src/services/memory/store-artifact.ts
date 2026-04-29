import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'node:crypto';
import { getEmbeddingDimension } from '../embedding/config.js';
import {
  getActivationPatternVectorName,
  getAdapterTitleVectorName,
  getPrimaryVectorName
} from '../../utils/qdrant-vector-types.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { redisCacheService } from '../redis-cache.js';
import { parseKairosUri } from '../../tools/kairos-uri.js';
import type { Memory } from '../../types/memory.js';
import type { StoreArtifactOptions } from './store-adapter.js';

export async function storeArtifact(
  client: QdrantClient,
  collection: string,
  content: string,
  options: StoreArtifactOptions
): Promise<Memory[]> {
  const parsed = parseKairosUri(options.adapterUri);
  if (parsed.kind !== 'adapter') {
    throw new Error('adapterUri must be a kairos://adapter/{uuid} URI');
  }
  const adapterId = parsed.id;
  const vectorSize = getEmbeddingDimension();
  const zeroVector = Array.from({ length: vectorSize }, () => 0);
  const context = getSpaceContext();
  const spaceId = context.defaultWriteSpaceId;
  const actorId = context.userId || 'system';
  const now = new Date().toISOString();
  const memoryUuid = crypto.randomUUID();
  const tags = ['artifact', options.mime.replace('text/', '')];

  await client.upsert(collection, {
    points: [{
      id: memoryUuid,
      vector: {
        [getPrimaryVectorName(vectorSize)]: zeroVector,
        [getAdapterTitleVectorName(vectorSize)]: zeroVector,
        [getActivationPatternVectorName(vectorSize)]: zeroVector
      },
      payload: {
        space_id: spaceId,
        label: options.name,
        tags,
        text: content,
        llm_model_id: options.llmModelId,
        created_at: now,
        created_by: actorId,
        modified_at: now,
        modified_by: actorId,
        content_type: options.mime,
        adapter: {
          id: adapterId,
          name: options.name
        }
      }
    }]
  });
  await redisCacheService.invalidateAfterUpdate();

  return [{
    memory_uuid: memoryUuid,
    space_id: spaceId,
    label: options.name,
    tags,
    text: content,
    llm_model_id: options.llmModelId,
    created_at: now,
    content_type: options.mime,
    adapter: {
      id: adapterId,
      name: options.name,
      layer_index: 0,
      layer_count: 0
    }
  }];
}
