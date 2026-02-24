import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { getSpaceContext, getSearchSpaceIds } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { DEFAULT_SPACE_ID } from '../../config.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { redisCacheService } from '../redis-cache.js';
import { embeddingService } from '../embedding/service.js';
import { buildHeaderMemoryChain as buildChain } from './chain-builder.js';

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

    // DEBUG: Qdrant retrieve
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
    const pointSpaceId = (point.payload as any)?.space_id ?? DEFAULT_SPACE_ID;
    if (!getSpaceContext().allowedSpaceIds.includes(pointSpaceId)) {
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
    const pointSpaceId = (point.payload as any)?.space_id ?? DEFAULT_SPACE_ID;
    if (!getSpaceContext().allowedSpaceIds.includes(pointSpaceId)) {
      return null;
    }
    return this.pointToMemory(point);
  }

  async searchMemories(query: string, limit: number, collapse: boolean = true): Promise<{ memories: Memory[], scores: number[] }> {
    const normalizedQuery = (query || '').trim().toLowerCase();

    if (!normalizedQuery) {
      return { memories: [], scores: [] };
    }

    // 1. Vector search (primary)
    const vectorResult = await this.vectorSearch(normalizedQuery, query, limit);

    // 2. Keyword fallback: if vector results insufficient, add keyword matches and merge
    if (vectorResult.memories.length < limit) {
      const keywordResult = await this.keywordSearch(normalizedQuery, limit);
      const merged = this.mergeSearchResults(vectorResult, keywordResult, limit);
      const result = {
        memories: merged.memories,
        scores: merged.scores
      };
      await redisCacheService.setSearchResult(normalizedQuery, limit, result, { collapse });
      return result;
    }

    await redisCacheService.setSearchResult(normalizedQuery, limit, vectorResult, { collapse });
    return vectorResult;
  }

  /** Vector similarity search only; used as primary path. */
  private async vectorSearch(normalizedQuery: string, query: string, limit: number): Promise<{ memories: Memory[], scores: number[] }> {
    const queryEmbeddingResult = await embeddingService.generateEmbedding(query);
    const queryVector = queryEmbeddingResult.embedding;
    const searchLimit = Math.min(limit * 3, 200);

    const searchSpaceIds = getSearchSpaceIds();
    const filter = buildSpaceFilter(searchSpaceIds);
    const vectorResults = await this.client.search(this.collection, {
      vector: { name: `vs${queryVector.length}`, vector: queryVector },
      limit: searchLimit,
      filter,
      with_payload: true,
      with_vector: false
    });

    // Raw Qdrant score + bounded quality boost from payload.quality_metadata.step_quality_score
    // so successful protocols rank higher. Boost capped so it does not dominate the vector score.
    const QUALITY_BOOST_COEFF = 0.1;
    const QUALITY_SCORE_CAP = 1;

    type SearchHit = { id: string | number; score?: number; payload?: Record<string, unknown> | null };
    const scored = (vectorResults || []).map((r: SearchHit) => {
      const payload = r.payload || {};
      const memory = this.pointToMemory({ id: String(r.id), payload });
      const rawScore = typeof r.score === 'number' ? r.score : 0.5;
      const qMeta = payload['quality_metadata'] as { step_quality_score?: number } | undefined;
      const stepQualityScore = typeof qMeta?.step_quality_score === 'number' ? qMeta.step_quality_score : 0;
      const boundedQuality = Math.min(Math.max(stepQualityScore, 0), QUALITY_SCORE_CAP);
      const score = rawScore * (1 + QUALITY_BOOST_COEFF * boundedQuality);
      return { memory, score };
    });

    let filtered = scored
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.memory.memory_uuid ?? '').localeCompare(b.memory.memory_uuid ?? '');
      })
      .slice(0, limit);

    if (filtered.length === 0 && scored.length > 0) {
      filtered = scored.slice(0, limit).map(entry => ({ memory: entry.memory, score: 0.5 }));
    }

    return {
      memories: filtered.map(entry => entry.memory),
      scores: filtered.map(entry => entry.score)
    };
  }

  /** Bounded scroll + in-memory label/text contains filter; used when vector results are insufficient. */
  private async keywordSearch(normalizedQuery: string, limit: number): Promise<{ memories: Memory[], scores: number[] }> {
    const maxScroll = 500;
    const filter = buildSpaceFilter(getSearchSpaceIds());
    const page = await this.client.scroll(this.collection, {
      filter,
      with_payload: true,
      with_vector: false,
      limit: maxScroll
    });
    const points = page?.points || [];
    const memories: Memory[] = [];
    for (const p of points) {
      const memory = this.pointToMemory({ id: String(p.id), payload: (p as { payload?: Record<string, unknown> }).payload || {} });
      const labelMatch = (memory.label || '').toLowerCase().includes(normalizedQuery);
      const textMatch = (memory.text || '').toLowerCase().includes(normalizedQuery);
      if (labelMatch || textMatch) {
        memories.push(memory);
        if (memories.length >= limit) break;
      }
    }
    const scores = memories.map(() => 0.5);
    return { memories, scores };
  }

  /** Merge vector and keyword results, deduplicate by memory_uuid, preserve order (vector first). */
  private mergeSearchResults(
    vectorResult: { memories: Memory[], scores: number[] },
    keywordResult: { memories: Memory[], scores: number[] },
    limit: number
  ): { memories: Memory[], scores: number[] } {
    const seen = new Set<string>();
    const memories: Memory[] = [];
    const scores: number[] = [];
    for (let i = 0; i < vectorResult.memories.length; i++) {
      const m = vectorResult.memories[i];
      if (!m || seen.has(m.memory_uuid)) continue;
      seen.add(m.memory_uuid);
      memories.push(m);
      scores.push(vectorResult.scores[i] ?? 0.5);
    }
    for (let i = 0; i < keywordResult.memories.length && memories.length < limit; i++) {
      const m = keywordResult.memories[i];
      if (!m || seen.has(m.memory_uuid)) continue;
      seen.add(m.memory_uuid);
      memories.push(m);
      scores.push(keywordResult.scores[i] ?? 0.5);
    }
    return {
      memories: memories.slice(0, limit),
      scores: scores.slice(0, limit)
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
        step_count: typeof payload.chain.step_count === 'number' ? payload.chain.step_count : 1
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
