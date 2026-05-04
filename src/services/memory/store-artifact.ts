import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'node:crypto';
import { getEmbeddingDimension } from '../embedding/config.js';
import { bm25Tokenizer } from '../embedding/bm25-tokenizer.js';
import {
  getActivationPatternVectorName,
  getAdapterTitleVectorName,
  getPrimaryVectorName
} from '../../utils/qdrant-vector-types.js';
import { getSearchSpaceIds, getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { redisCacheService } from '../redis-cache.js';
import { logger } from '../../utils/structured-logger.js';
import { parseKairosUri, type ParsedKairosUri } from '../../tools/kairos-uri.js';
import type { Memory } from '../../types/memory.js';
import type { StoreArtifactOptions } from './store-adapter.js';
import { extractArtifactMetadata } from './artifact-metadata.js';

async function resolveAdapterAnchorPointId(
  client: QdrantClient,
  collectionName: string,
  slug: string
): Promise<string | null> {
  const normalized = (slug || '').trim().toLowerCase();
  if (!normalized) return null;
  const filter = buildSpaceFilter(getSearchSpaceIds(), {
    must: [
      { key: 'slug', match: { value: normalized } },
      { key: 'adapter.layer_index', match: { value: 1 } }
    ]
  });
  const ids: string[] = [];
  let offset: unknown = undefined;
  do {
    const page = await client.scroll(collectionName, {
      filter,
      limit: 64,
      offset,
      with_payload: false,
      with_vector: false
    } as any);
    const pts = page.points || [];
    for (const p of pts) {
      ids.push(String(p.id));
    }
    offset = page.next_page_offset;
  } while (offset);
  if (ids.length === 0) return null;
  ids.sort((a, b) => a.localeCompare(b));
  return ids[0] ?? null;
}

/**
 * Export and search index artifacts by `payload.adapter.id` (chain id). Train may pass a slug,
 * a layer point id, or a chain id in `kairos://adapter/...`; normalize to the chain id.
 */
async function resolveChainAdapterIdForArtifacts(
  client: QdrantClient,
  collectionName: string,
  parsed: Extract<ParsedKairosUri, { kind: 'adapter' }>
): Promise<string> {
  if (parsed.idKind === 'slug') {
    const headPointId = await resolveAdapterAnchorPointId(client, collectionName, parsed.id);
    if (!headPointId) {
      throw new Error(`Adapter slug "${parsed.id}" was not found for artifact attachment`);
    }
    const rows = await client.retrieve(collectionName, { ids: [headPointId], with_payload: true });
    const adapter = (rows[0]?.payload as { adapter?: { id?: string } } | undefined)?.adapter;
    if (typeof adapter?.id === 'string' && adapter.id.length > 0) return adapter.id;
    return headPointId;
  }
  const rows = await client.retrieve(collectionName, { ids: [parsed.id], with_payload: true });
  if (Array.isArray(rows) && rows.length > 0) {
    const adapter = (rows[0]?.payload as { adapter?: { id?: string } } | undefined)?.adapter;
    if (typeof adapter?.id === 'string' && adapter.id.length > 0) return adapter.id;
  }
  return parsed.id;
}

export async function storeArtifact(
  client: QdrantClient,
  collection: string,
  content: string,
  options: StoreArtifactOptions
): Promise<Memory[]> {
  const parsed = parseKairosUri(options.adapterUri);
  if (parsed.kind !== 'adapter') {
    throw new Error('adapterUri must be a kairos://adapter/{slug|uuid} URI');
  }
  const adapterId = await resolveChainAdapterIdForArtifacts(client, collection, parsed);
  const slugSource =
    typeof options.relativePath === 'string' && options.relativePath.trim().length > 0
      ? options.relativePath.trim()
      : options.name;
  const artifact = extractArtifactMetadata(content, slugSource);
  const sha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const vectorSize = getEmbeddingDimension();
  const zeroVector = Array.from({ length: vectorSize }, () => 0);
  const context = getSpaceContext();
  const spaceId = context.defaultWriteSpaceId;
  const actorId = context.userId || 'system';
  const now = new Date().toISOString();
  const memoryUuid = crypto.randomUUID();
  const tags = ['artifact', options.mime.replace('text/', ''), `artifact:${artifact.slug}`];

  const duplicate = await client.scroll(collection, {
    filter: {
      must: [
        { key: 'space_id', match: { value: spaceId } },
        { key: 'adapter.id', match: { value: adapterId } },
        { key: 'artifact.slug', match: { value: artifact.slug } }
      ]
    },
    limit: 2,
    with_payload: true,
    with_vector: false
  });
  if (Array.isArray(duplicate.points) && duplicate.points.length > 0) {
    throw new Error(`Artifact slug "${artifact.slug}" already exists on this adapter`);
  }

  const sparseText = `${options.name}\n${artifact.slug}\n${content.slice(0, 4096)}`;
  const bm25 = bm25Tokenizer.tokenize(sparseText);
  const denseVectors = {
    [getPrimaryVectorName(vectorSize)]: zeroVector,
    [getAdapterTitleVectorName(vectorSize)]: zeroVector,
    [getActivationPatternVectorName(vectorSize)]: zeroVector
  };
  const point = {
    id: memoryUuid,
    vector: {
      ...denseVectors,
      bm25: { indices: bm25.indices, values: bm25.values }
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
      artifact: {
        slug: artifact.slug,
        version: artifact.version,
        name: options.name,
        sha256,
        ...(typeof options.relativePath === 'string' && options.relativePath.trim().length > 0
          ? { relative_path: options.relativePath.trim() }
          : {})
      },
      adapter: {
        id: adapterId,
        name: options.name
      }
    }
  };

  try {
    await client.upsert(collection, { points: [point] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Bad Request') || msg.includes('sparse') || msg.includes('vector')) {
      logger.warn(`[Qdrant][upsert][artifact] retrying without bm25: ${msg}`);
      await client.upsert(collection, {
        points: [{ ...point, vector: denseVectors }]
      } as Parameters<QdrantClient['upsert']>[1]);
    } else {
      throw err;
    }
  }
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
    artifact: {
      slug: artifact.slug,
      version: artifact.version,
      name: options.name,
      sha256,
      ...(typeof options.relativePath === 'string' && options.relativePath.trim().length > 0
        ? { relative_path: options.relativePath.trim() }
        : {})
    },
    adapter: {
      id: adapterId,
      name: options.name,
      layer_index: 0,
      layer_count: 0
    }
  }];
}
