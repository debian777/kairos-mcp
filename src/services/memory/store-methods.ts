import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/structured-logger.js';
import { KAIROS_APP_SPACE_ID } from '../../config.js';
import { getSpaceContext, getSearchSpaceIds } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { redisCacheService } from '../redis-cache.js';
import { embeddingService } from '../embedding/service.js';
import { bm25Tokenizer } from '../embedding/bm25-tokenizer.js';
import { buildHeaderMemoryChain as buildChain } from './chain-builder.js';
import { scoreActivationRerank } from './activation-reranker.js';

/** Built-in refine protocol (always offered at the bottom of search results). Excluded from vector results. */
const REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';

export class MemoryQdrantStoreMethods {
  private client: QdrantClient;
  private collection: string;
  private cache = new Map<string, Memory>();
  private cacheLoaded = false;
  private url: string;
  private codeBlockProcessor: CodeBlockProcessor;

  constructor(client: QdrantClient, collection: string, url: string, codeBlockProcessor: CodeBlockProcessor) {
    this.client = client;
    this.collection = collection;
    this.url = url;
    this.codeBlockProcessor = codeBlockProcessor;
  }

  // Invalidate local in-memory cache so subsequent searches reload from Qdrant
  invalidateLocalCache(): void {
    this.cache.clear();
    this.cacheLoaded = false;
  }

  async getMemory(memory_uuid: string): Promise<Memory | null> {
    if (!memory_uuid) return null;
    const cached = this.cache.get(memory_uuid);
    if (cached) return cached;

    const retrieveReq = {
      ids: [memory_uuid],
      with_payload: true,
      with_vector: false
    } as any;
    logger.debug(`[Qdrant][retrieve] collection=${this.collection} req=${JSON.stringify(retrieveReq)}`);
    const points = await this.client.retrieve(this.collection, {
      ids: [memory_uuid],
      with_payload: true,
      with_vector: false
    });
    logger.debug(`[Qdrant][retrieve] result_count=${points?.length || 0}`);

    if (!points || points.length === 0) {
      return null;
    }
    const point = points[0]!;
    const pointSpaceId = (point.payload as any)?.space_id ?? KAIROS_APP_SPACE_ID;
    const allowed = getSpaceContext().allowedSpaceIds;
    const canRead = allowed.includes(pointSpaceId) || pointSpaceId === KAIROS_APP_SPACE_ID;
    if (!canRead) {
      return null;
    }

    const memory = this.pointToMemory(point);
    this.cache.set(memory.memory_uuid, memory);
    return memory;
  }

  // Fetch bypassing in-process cache to ensure freshest view (e.g., after updates)
  async getMemoryFresh(memory_uuid: string): Promise<Memory | null> {
    if (!memory_uuid) return null;
    const points = await this.client.retrieve(this.collection, {
      ids: [memory_uuid],
      with_payload: true,
      with_vector: false
    });
    if (!points || points.length === 0) return null;
    const point = points[0]!;
    const pointSpaceId = (point.payload as any)?.space_id ?? KAIROS_APP_SPACE_ID;
    const allowed = getSpaceContext().allowedSpaceIds;
    const canRead = allowed.includes(pointSpaceId) || pointSpaceId === KAIROS_APP_SPACE_ID;
    if (!canRead) {
      return null;
    }
    return this.pointToMemory(point);
  }

  async searchMemories(query: string, limit: number, collapse: boolean = true): Promise<{ memories: Memory[], scores: number[] }> {
    const queryKey = (query || '').trim();

    if (!queryKey) {
      return { memories: [], scores: [] };
    }

    const vectorResult = await this.vectorSearch(queryKey, limit);
    await redisCacheService.setSearchResult(queryKey, limit, vectorResult, { collapse });
    return vectorResult;
  }

  /**
   * Hybrid search: dense + BM25 via Query API with formula-based adapter-title
   * boosting. The storage layer currently persists both adapter.* and chain.*
   * fields while the codebase moves to adapter-oriented naming.
   */
  private async vectorSearch(query: string, limit: number): Promise<{ memories: Memory[], scores: number[] }> {
    const queryEmbeddingResult = await embeddingService.generateEmbedding(query);
    const queryVector = queryEmbeddingResult.embedding;
    const vectorName = `vs${queryVector.length}`;
    const searchLimit = Math.min(limit * 3, 200);
    const sparseQuery = bm25Tokenizer.tokenize(query);

    const searchSpaceIds = getSearchSpaceIds();
    const baseFilter = buildSpaceFilter(searchSpaceIds, {
      must: [{ key: 'adapter.layer_index', match: { value: 1 } }]
    });
    const filter = {
      ...baseFilter,
      must_not: [{ has_id: [REFINING_PROTOCOL_UUID] }]
    };

    const bm25Leg = {
      query: { indices: sparseQuery.indices, values: sparseQuery.values },
      using: 'bm25' as const,
      filter
    };

    let points: Array<{ id: string | number; score?: number; payload?: Record<string, unknown> | null }>;
    try {
      const TITLE_BOOST = 0.5;
      const queryResponse = await this.client.query(this.collection, {
        prefetch: {
          prefetch: [
            {
              query: queryVector,
              using: vectorName,
              limit: 40,
              filter,
              params: { quantization: { rescore: true } }
            },
            { ...bm25Leg, limit: 40 },
            { ...bm25Leg, limit: 30 },
            { ...bm25Leg, limit: 20 }
          ],
          query: { fusion: 'rrf' },
          limit: 50,
        },
        query: {
          formula: {
            sum: [
              '$score',
              {
                mult: [
                  TITLE_BOOST,
                  { key: 'adapter.name', match: { text: query } }
                ]
              },
              'attest_boost'
            ]
          },
          defaults: { attest_boost: 0 }
        },
        with_payload: true,
        limit: searchLimit
      });
      points = queryResponse?.points ?? [];
    } catch (queryErr) {
      logger.warn(
        `Hybrid query failed, falling back to dense search: ${queryErr instanceof Error ? queryErr.message : String(queryErr)}`
      );
      const searchResults = await this.client.search(this.collection, {
        vector: { name: vectorName, vector: queryVector },
        limit: searchLimit,
        filter,
        params: { quantization: { rescore: true } },
        with_payload: true,
        with_vector: false
      });
      points = searchResults ?? [];
    }
    type SearchHit = { id: string | number; score?: number; payload?: Record<string, unknown> | null };
    const scored = points.map((r: SearchHit) => {
      const payload = r.payload || {};
      const memory = this.pointToMemory({ id: String(r.id), payload });
      const score = typeof r.score === 'number' ? r.score : 0.5;
      const rerankBoost = scoreActivationRerank(query, memory);
      return { memory, score, rerankScore: score + rerankBoost };
    });

    const isRefineProtocol = (m: Memory) =>
      m.memory_uuid === REFINING_PROTOCOL_UUID ||
      m.adapter?.id === REFINING_PROTOCOL_UUID ||
      m.chain?.id === REFINING_PROTOCOL_UUID;
    let filtered = scored
      .filter(entry => entry.score > 0 && !isRefineProtocol(entry.memory))
      .sort((a, b) => {
        if (b.rerankScore !== a.rerankScore) return b.rerankScore - a.rerankScore;
        if (b.score !== a.score) return b.score - a.score;
        return (a.memory.memory_uuid ?? '').localeCompare(b.memory.memory_uuid ?? '');
      })
      .slice(0, limit);

    if (filtered.length === 0 && scored.length > 0) {
      filtered = scored
        .filter(entry => !isRefineProtocol(entry.memory))
        .slice(0, limit)
        .map(entry => ({ memory: entry.memory, score: 0.5, rerankScore: 0.5 }));
    }

    return {
      memories: filtered.map(entry => entry.memory),
      scores: filtered.map(entry => entry.score)
    };
  }

  private pointToMemory(point: any): Memory {
    const payload = point.payload || {};
    const memoryUuid = point.id ? String(point.id) : crypto.randomUUID();
    const base: any = {
      memory_uuid: memoryUuid,
      label: typeof payload.label === 'string' && payload.label.length > 0 ? payload.label : 'Memory',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      text: typeof payload.text === 'string' ? payload.text : '',
      llm_model_id: typeof payload.llm_model_id === 'string' ? payload.llm_model_id : 'unknown-model',
      created_at: typeof payload.created_at === 'string' ? payload.created_at : new Date().toISOString()
    };
    const payloadAdapter =
      payload.adapter && typeof payload.adapter.id === 'string'
        ? payload.adapter
        : payload.chain && typeof payload.chain.id === 'string'
          ? {
              id: payload.chain.id,
              name: payload.chain.label,
              layer_index: payload.chain.step_index,
              layer_count: payload.chain.step_count,
              protocol_version: (payload.chain as any).protocol_version,
              activation_patterns: (payload.chain as any).activation_patterns
            }
          : typeof payload.memory_chain_id === 'string'
            ? {
                id: payload.memory_chain_id,
                name: typeof payload.chain_label === 'string' ? payload.chain_label : 'Knowledge Adapter',
                layer_index: typeof payload.chain_step_index === 'number' ? payload.chain_step_index : 1,
                layer_count: typeof payload.chain_step_count === 'number' ? payload.chain_step_count : 1
              }
            : null;

    if (payloadAdapter) {
      base.adapter = {
        id: payloadAdapter.id,
        name: typeof payloadAdapter.name === 'string'
          ? payloadAdapter.name
          : typeof payloadAdapter.label === 'string'
            ? payloadAdapter.label
            : 'Knowledge Adapter',
        layer_index: typeof payloadAdapter.layer_index === 'number'
          ? payloadAdapter.layer_index
          : typeof payloadAdapter.step_index === 'number'
            ? payloadAdapter.step_index
            : 1,
        layer_count: typeof payloadAdapter.layer_count === 'number'
          ? payloadAdapter.layer_count
          : typeof payloadAdapter.step_count === 'number'
            ? payloadAdapter.step_count
            : 1,
        ...(typeof payloadAdapter.protocol_version === 'string' && {
          protocol_version: payloadAdapter.protocol_version
        }),
        ...(Array.isArray(payloadAdapter.activation_patterns) && {
          activation_patterns: payloadAdapter.activation_patterns
        })
      };
      base.chain = {
        id: base.adapter.id,
        label: base.adapter.name,
        step_index: base.adapter.layer_index,
        step_count: base.adapter.layer_count,
        ...(base.adapter.protocol_version && {
          protocol_version: base.adapter.protocol_version
        }),
        ...(base.adapter.activation_patterns && {
          activation_patterns: base.adapter.activation_patterns
        })
      };
      base.activation_patterns = base.adapter.activation_patterns ?? [];
    }

    const payloadContract =
      payload.inference_contract && typeof payload.inference_contract === 'object'
        ? payload.inference_contract
        : payload.proof_of_work && typeof payload.proof_of_work === 'object'
          ? payload.proof_of_work
          : null;

    if (payloadContract) {
      const contract = payloadContract as Record<string, unknown>;
      if (typeof contract['cmd'] === 'string') {
        base.inference_contract = {
          cmd: contract['cmd'],
          timeout_seconds: typeof contract['timeout_seconds'] === 'number'
            ? contract['timeout_seconds']
            : 60,
          required: Boolean(contract['required'])
        };
      } else {
        base.inference_contract =
          contract as unknown as import('../../types/memory.js').InferenceContractDefinition;
      }
      base.proof_of_work = base.inference_contract;
    }

    return base as Memory;
  }

  /** @deprecated No longer used by searchMemories (replaced by Qdrant vector search). Kept for optional full-load paths. */
  private async ensureCache(): Promise<void> {
    if (this.cacheLoaded) return;
    let pageOffset: any = undefined;
    do {
      const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds);
      const page = await this.client.scroll(this.collection, {
        filter,
        with_payload: true,
        with_vector: false,
        limit: 128,
        offset: pageOffset
      } as any);
      (page.points || []).forEach((point: any) => {
        const memory = this.pointToMemory(point);
        this.cache.set(memory.memory_uuid, memory);
      });

      pageOffset = page.next_page_offset;
    } while (pageOffset);

    this.cacheLoaded = true;
  }

  buildHeaderMemoryChain(markdownDoc: string, llmModelId: string, now: Date): Memory[] {
    return buildChain(markdownDoc, llmModelId, now, this.codeBlockProcessor);
  }
}
