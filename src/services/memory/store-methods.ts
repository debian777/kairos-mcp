import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { MIN_ATTEST_RUNS, RUNS_FULL_CONFIDENCE, ATTEST_BOOST_MAX, KAIROS_APP_SPACE_ID } from '../../config.js';
import { getSpaceContext, getSearchSpaceIds } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { redisCacheService } from '../redis-cache.js';
import { embeddingService } from '../embedding/service.js';
import { bm25Tokenizer } from '../embedding/bm25-tokenizer.js';
import { buildHeaderMemoryChain as buildChain } from './chain-builder.js';

/** Built-in refine protocol (always offered at bottom of kairos_search). Excluded from vector results. */
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


  private parseMarkdownSections(content: string): Array<{ title: string, content: string }> {
    const lines = content.split(/\r?\n/);
    const sections: Array<{ title: string, content: string }> = [];
    let currentSection: { title: string, content: string[] } | null = null;

    for (const line of lines) {
      if (line.trim().startsWith('## ')) {
        // Start new section
        if (currentSection) {
          sections.push({
            title: currentSection.title,
            content: currentSection.content.join('\n')
          });
        }
        currentSection = {
          title: line.trim().substring(3).trim(),
          content: []
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    }

    // Add the last section
    if (currentSection) {
      sections.push({
        title: currentSection.title,
        content: currentSection.content.join('\n').trim()
      });
    }

    return sections;
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
    const normalizedQuery = (query || '').trim().toLowerCase();

    if (!normalizedQuery) {
      return { memories: [], scores: [] };
    }

    const vectorResult = await this.vectorSearch(normalizedQuery, query, limit);
    await redisCacheService.setSearchResult(normalizedQuery, limit, vectorResult, { collapse });
    return vectorResult;
  }

  /**
   * Hybrid search: dense + BM25 via Query API with formula-based title boosting.
   * Inner prefetch: 1× dense + 3× BM25 fused via RRF.
   * Outer query: formula = $score + TITLE_BOOST * match(chain.label, text: query).
   * match.text requires ALL query tokens in chain.label, boosting only exact title matches.
   */
  private async vectorSearch(normalizedQuery: string, query: string, limit: number): Promise<{ memories: Memory[], scores: number[] }> {
    const queryEmbeddingResult = await embeddingService.generateEmbedding(query);
    const queryVector = queryEmbeddingResult.embedding;
    const vectorName = `vs${queryVector.length}`;
    const searchLimit = Math.min(limit * 3, 200);
    const sparseQuery = bm25Tokenizer.tokenize(query);

    const searchSpaceIds = getSearchSpaceIds();
    const baseFilter = buildSpaceFilter(searchSpaceIds, {
      must: [{ key: 'chain.step_index', match: { value: 1 } }]
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
                  { key: 'chain.label', match: { text: normalizedQuery } }
                ]
              }
            ]
          }
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
      let score = typeof r.score === 'number' ? r.score : 0.5;
      const qm = (payload['quality_metrics'] as { successCount?: number; failureCount?: number } | undefined) ?? {};
      const successCount = typeof qm.successCount === 'number' ? qm.successCount : 0;
      const failureCount = typeof qm.failureCount === 'number' ? qm.failureCount : 0;
      const runs = successCount + failureCount;
      let attestBoost = 0;
      if (runs >= MIN_ATTEST_RUNS) {
        const successRatio = runs > 0 ? successCount / runs : 0;
        const confidence = Math.min(runs / RUNS_FULL_CONFIDENCE, 1);
        attestBoost = Math.min(ATTEST_BOOST_MAX * successRatio * confidence, ATTEST_BOOST_MAX);
        logger.debug(
          `[vectorSearch] attest boost point=${r.id} runs=${runs} successRatio=${successRatio.toFixed(2)} confidence=${confidence.toFixed(2)} boost=${attestBoost.toFixed(4)}`
        );
      }
      score += attestBoost;
      return { memory, score };
    });

    const isRefineProtocol = (m: Memory) =>
      m.memory_uuid === REFINING_PROTOCOL_UUID || m.chain?.id === REFINING_PROTOCOL_UUID;
    let filtered = scored
      .filter(entry => entry.score > 0 && !isRefineProtocol(entry.memory))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.memory.memory_uuid ?? '').localeCompare(b.memory.memory_uuid ?? '');
      })
      .slice(0, limit);

    if (filtered.length === 0 && scored.length > 0) {
      filtered = scored
        .filter(entry => !isRefineProtocol(entry.memory))
        .slice(0, limit)
        .map(entry => ({ memory: entry.memory, score: 0.5 }));
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
    // Build chain object from payload if chain fields exist
    if (payload.chain && typeof payload.chain.id === 'string') {
      base.chain = {
        id: payload.chain.id,
        label: typeof payload.chain.label === 'string' ? payload.chain.label : 'Knowledge Chain',
        step_index: typeof payload.chain.step_index === 'number' ? payload.chain.step_index : 1,
        step_count: typeof payload.chain.step_count === 'number' ? payload.chain.step_count : 1,
        ...(typeof (payload.chain as any).protocol_version === 'string' && {
          protocol_version: (payload.chain as any).protocol_version
        })
      };
    } else if (typeof payload.memory_chain_id === 'string') {
      // Backward compatibility: read flat fields during transition
      base.chain = {
        id: payload.memory_chain_id,
        label: typeof payload.chain_label === 'string' ? payload.chain_label : 'Knowledge Chain',
        step_index: typeof payload.chain_step_index === 'number' ? payload.chain_step_index : 1,
        step_count: typeof payload.chain_step_count === 'number' ? payload.chain_step_count : 1
      };
    }
    if (payload.proof_of_work && typeof payload.proof_of_work === 'object') {
      const pow = payload.proof_of_work as Record<string, unknown>;
      if (typeof pow['cmd'] === 'string') {
        base.proof_of_work = {
          cmd: pow['cmd'],
          timeout_seconds: typeof pow['timeout_seconds'] === 'number' ? pow['timeout_seconds'] : 60,
          required: Boolean(pow['required'])
        };
      } else {
        base.proof_of_work = pow as unknown as import('../../types/memory.js').ProofOfWorkDefinition;
      }
    }
    return base as Memory;
  }

  /** @deprecated No longer used by searchMemories (replaced by Qdrant vector search). Kept for optional full-load paths. */
  private async ensureCache(): Promise<void> {
    if (this.cacheLoaded) return;
    let pageOffset: any = undefined;
    do {
      const scrollReq = {
        with_payload: true,
        with_vector: false,
        limit: 128,
        offset: pageOffset
      } as any;
      const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds);
      logger.debug(`[Qdrant][scroll] collection=${this.collection} req=${JSON.stringify(scrollReq)}`);
      const page = await this.client.scroll(this.collection, {
        filter,
        with_payload: true,
        with_vector: false,
        limit: 128,
        offset: pageOffset
      } as any);
      logger.debug(`[Qdrant][scroll] page_count=${page?.points?.length || 0} next=${JSON.stringify(page?.next_page_offset)}`);

      (page.points || []).forEach((point: any) => {
        const memory = this.pointToMemory(point);
        this.cache.set(memory.memory_uuid, memory);
      });

      pageOffset = page.next_page_offset;
    } while (pageOffset);

    this.cacheLoaded = true;
  }

  /**
   * Build a linked memory chain from a single markdown document using H1/H2 headers.
   * H1 becomes the base label; each H2 section becomes one Memory with prev/next links.
   */
  buildHeaderMemoryChain(markdownDoc: string, llmModelId: string, now: Date): Memory[] {
    return buildChain(markdownDoc, llmModelId, now, this.codeBlockProcessor);
  }
}
