import type { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { embeddingService } from '../embedding/service.js';
import { KAIROS_CREATION_PROTOCOL_UUID, KAIROS_REFINING_PROTOCOL_UUID, memoryIsBuiltinSearchFooterProtocol } from '../../constants/builtin-search-meta.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { getSearchSpaceIds } from '../../utils/tenant-context.js';
import { getAdapterTitleVectorName } from '../../utils/qdrant-vector-types.js';

export async function searchAdapterTitlesBySimilarity(params: {
  client: QdrantClient;
  collection: string;
  query: string;
  limit: number;
  mapPointToMemory: (point: { id: string; payload: Record<string, unknown> }) => Memory;
}): Promise<{ memories: Memory[]; scores: number[] }> {
  const queryKey = (params.query || '').trim();

  if (!queryKey) {
    return { memories: [], scores: [] };
  }

  const queryEmbeddingResult = await embeddingService.generateEmbedding(queryKey);
  const queryVector = queryEmbeddingResult.embedding;
  const titleVectorName = getAdapterTitleVectorName(queryVector.length);
  const searchSpaceIds = getSearchSpaceIds();
  const baseFilter = buildSpaceFilter(searchSpaceIds, {
    must: [{ key: 'adapter.layer_index', match: { value: 1 } }]
  });
  const filter = {
    ...baseFilter,
    must_not: [{ has_id: [KAIROS_REFINING_PROTOCOL_UUID, KAIROS_CREATION_PROTOCOL_UUID] }]
  };
  const points = await params.client.search(params.collection, {
    vector: { name: titleVectorName, vector: queryVector },
    limit: params.limit,
    filter,
    params: { quantization: { rescore: true } },
    with_payload: true,
    with_vector: false
  });

  const filtered = (points ?? [])
    .map((point: any) => {
      const memory = params.mapPointToMemory({ id: String(point.id), payload: point.payload || {} });
      const score = typeof point.score === 'number' ? point.score : 0;
      return { memory, score };
    })
    .filter(entry => entry.score > 0 && !memoryIsBuiltinSearchFooterProtocol(entry.memory))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.memory.memory_uuid ?? '').localeCompare(b.memory.memory_uuid ?? '');
    })
    .slice(0, params.limit);

  return {
    memories: filtered.map(entry => entry.memory),
    scores: filtered.map(entry => entry.score)
  };
}
