import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { redisCacheService } from '../redis-cache.js';
import {
  scoreMemory
} from '../../utils/memory-store-utils.js';
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

    const memory = this.pointToMemory(points[0]);
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
    return this.pointToMemory(points[0]);
  }

  async searchMemories(query: string, limit: number, collapse: boolean = true): Promise<{ memories: Memory[], scores: number[] }> {
    const normalizedQuery = (query || '').trim().toLowerCase();

    if (!normalizedQuery) {
      return { memories: [], scores: [] };
    }

    // Perform search
    await this.ensureCache();
    const scored = Array.from(this.cache.values()).map(memory => ({
      memory,
      score: scoreMemory(memory, normalizedQuery)
    }));

    const filtered = scored
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Fallback: if nothing matched the scorer, try a simple contains() check over label/text
    let result = {
      memories: filtered.map(entry => entry.memory),
      scores: filtered.map(entry => entry.score)
    };

    if (result.memories.length === 0) {
      const contains = Array.from(this.cache.values())
        .filter(m => m.label.toLowerCase().includes(normalizedQuery) || m.text.toLowerCase().includes(normalizedQuery))
        .slice(0, limit);
      if (contains.length > 0) {
        result = {
          memories: contains,
          scores: contains.map(() => 0.5) // neutral score for fallback
        };
      }
    }

    // Cache the result using collapse flag in the cache key so different search behaviors don't collide
    await redisCacheService.setSearchResult(normalizedQuery, limit, result, { collapse });

    return result;
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
    if (payload.proof_of_work && typeof payload.proof_of_work.cmd === 'string') {
      base.proof_of_work = {
        cmd: payload.proof_of_work.cmd,
        timeout_seconds: typeof payload.proof_of_work.timeout_seconds === 'number'
          ? payload.proof_of_work.timeout_seconds
          : 60,
        required: Boolean(payload.proof_of_work.required)
      };
    }
    return base as Memory;
  }

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
      logger.debug(`[Qdrant][scroll] collection=${this.collection} req=${JSON.stringify(scrollReq)}`);
      const page = await this.client.scroll(this.collection, {
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
