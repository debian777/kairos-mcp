/* eslint-disable max-lines */
import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { IDGenerator } from '../id-generator.js';
import { KairosError } from '../../types/index.js';
import { embeddingService } from '../embedding/service.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { MemoryQdrantStoreMethods } from './store-methods.js';
import { knowledgeGame } from '../game/knowledge-game.js';
import { redisCacheService } from '../redis-cache.js';
import {
  normalizeMarkdownBlob,
  generateLabel,
  generateTags
} from '../../utils/memory-store-utils.js';
import { getEmbeddingDimension } from '../../config.js';
import { memoryStore, memoryStoreDuration, memoryChainSize } from '../metrics/memory-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

export class MemoryQdrantStoreChain {
  constructor(
    private client: QdrantClient,
    private collection: string,
    private codeBlockProcessor: CodeBlockProcessor,
    private methods: MemoryQdrantStoreMethods
  ) {}

  private deriveDomainTaskType(label: string, text: string, tags: string[]) {
    const lower = (s: string) => (s || '').toLowerCase();
    const ltext = `${lower(label)}\n${lower(text)}`;
    const ltags = (tags || []).map(t => lower(t));

    const tasks = ['networking', 'security', 'optimization', 'troubleshooting', 'error-handling', 'installation', 'configuration', 'testing', 'deployment', 'database'] as const;

    const task = tasks.find(t => ltags.includes(t) || ltext.includes(t)) || 'general';

    let type: 'pattern' | 'rule' | 'context' = 'context';
    if (/```/.test(text) || ltags.includes('pattern') || ltext.includes('pattern')) type = 'pattern';
    else if (ltags.includes('rule') || ltext.includes('rule')) type = 'rule';

    return { task, type };
  }

  async storeChain(docs: string[], llmModelId: string, options: { forceUpdate?: boolean } = {}): Promise<Memory[]> {
    const tenantId = getTenantId();
    const timer = memoryStoreDuration.startTimer({ tenant_id: tenantId });
    
    try {
      if (!Array.isArray(docs) || docs.length === 0) {
        return [];
      }

    // Normalize inputs: support both plain markdown strings and JSON-stringified markdown.
    const normalizedDocs = docs.map(normalizeMarkdownBlob);
    logger.debug(
      `[MemoryQdrantStore] storeChain normalizedDocs lengths=${normalizedDocs.map(d => d?.length ?? 0).join(',')}`
    );

    const now = new Date();

    // Special case: if we have a single doc, try header-based slicing first.
    // If that fails, fallback to single memory storage.
    if (normalizedDocs.length === 1) {
      const markdownDoc = normalizedDocs[0]!;
      const headerChainMemories = this.methods.buildHeaderMemoryChain(markdownDoc, llmModelId, now);

      if (headerChainMemories.length > 0) {

        // Determine chain label and deterministic v5 chain UUID (prefer explicit chain.label)
        const firstLabel = headerChainMemories[0]?.label || 'Knowledge Chain';
        const explicitChainLabel = headerChainMemories[0]?.chain?.label;
        const chainLabel = (explicitChainLabel && explicitChainLabel.trim().length > 0)
          ? explicitChainLabel.trim()
          : (firstLabel.includes(':') ? firstLabel.split(':')[0]!.trim() : firstLabel.trim());
        const chainUuid = IDGenerator.generateChainUUIDv5(chainLabel);

        // Duplicate pre-check by chain.id
        const dupReq = {
          filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
          limit: 256,
          with_payload: true,
          with_vector: false
        } as any;
        logger.debug(`[Qdrant][scroll-dup] collection=${this.collection} req=${JSON.stringify(dupReq)}`);
        const dup = await this.client.scroll(this.collection, {
          filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
          limit: 256,
          with_payload: true,
          with_vector: false
        } as any);
        logger.debug(`[Qdrant][scroll-dup] result_count=${dup?.points?.length || 0}`);

        if ((dup.points?.length || 0) > 0) {
          if (!options.forceUpdate) {
            const items = (dup.points || []).map((p: any) => ({
              label: (p.payload?.label as string) || 'Memory',
              uri: `kairos://mem/${String(p.id)}`
            }));
            throw new KairosError('Duplicate memory chain', 'DUPLICATE_CHAIN', 409, { chain_id: chainUuid, items });
          }
          const delReq = { filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] } } as any;
          logger.debug(`[Qdrant][delete-chain] collection=${this.collection} req=${JSON.stringify(delReq)}`);
          await this.client.delete(this.collection, delReq);
        }

        // Generate embeddings for each H2 section to upsert proper vectors.
        const sectionTexts = headerChainMemories.map(m => m.text);
        const vectorSize = getEmbeddingDimension();
        const currentVectorName = `vs${vectorSize}`;
        let vectors: number[][];
        try {
          const batch = await embeddingService.generateBatchEmbeddings(sectionTexts);
          vectors = batch.embeddings;
          // Basic safety checks: shape and dimension
          const wrongCount = vectors.length !== headerChainMemories.length;
          const wrongDim = vectors.some(v => !Array.isArray(v) || v.length !== vectorSize);
          if (wrongCount || wrongDim) {
            logger.warn(
              `[MemoryQdrantStore] Embedding shape mismatch for header-based chain (count=${vectors.length}/${headerChainMemories.length}, dimOK=${!wrongDim}). Falling back to zero vectors.`
            );
            vectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
          }
        } catch (err) {
          logger.error('[MemoryQdrantStore] Failed to generate embeddings for header-based chain; falling back to zero vectors', err);
          vectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
        }

        const chainStepCount = headerChainMemories.length;

        const points = headerChainMemories.map((memory, i) => {
          const dtt = this.deriveDomainTaskType(memory.label, memory.text, memory.tags);
          const gem = knowledgeGame.calculateStepGemMetadata(
            memory.label,
            'general',
            dtt.task,
            dtt.type,
            memory.tags
          );
          return ({
            id: memory.memory_uuid,
            vector: { [currentVectorName]: vectors[i]! },
            payload: {
              label: memory.label,
              tags: memory.tags,
              text: memory.text,
              llm_model_id: memory.llm_model_id,
              created_at: memory.created_at,
              // basic classification for game + filtering (domain removed)
              task: dtt.task,
              type: dtt.type,
              // gem metadata (no execution context on store)
              gem_metadata: {
                step_gem_potential: gem.step_gem_potential,
                step_quality: gem.step_quality,
                motivational_text: gem.motivational_text
              },
              // memory chain metadata (nested object)
              chain: {
                id: chainUuid,
                label: chainLabel,
                step_index: i + 1,
                step_count: chainStepCount
              }
            }
          });
        });

        // Debug: log exactly what we send to Qdrant in the header-based path
        logger.tool(
          'memory-qdrant-store',
          'upsert',
          `mode=h1-h2 sections=${headerChainMemories.length} collection=${this.collection} payload=${JSON.stringify({
            points
          })}`
        );

        logger.debug(`[Qdrant][upsert] collection=${this.collection} points=${points.length}`);
        await this.client.upsert(this.collection, { points });

        // Publish cache invalidation
        await redisCacheService.invalidateAfterUpdate();
        // Invalidate local in-process cache so searches see new points
        this.methods.invalidateLocalCache();

        // Update Knowledge Mining Game leaderboard for each stored step
        for (const memory of headerChainMemories) {
          try {
            const { task, type } = this.deriveDomainTaskType(memory.label, memory.text, memory.tags);
            const score = knowledgeGame.calculateGemScore(memory.label, task, type, memory.tags);
            await knowledgeGame.processGemDiscovery(memory.llm_model_id, score, memory.label);
            
            // Track memory store with quality
            const quality = score.quality === 'legendary' ? 'excellent' :
                           score.quality === 'rare' ? 'high' :
                           score.quality === 'quality' ? 'standard' : 'basic';
            memoryStore.inc({ quality, tenant_id: tenantId });
            
            // Track chain size
            if (memory.chain) {
              memoryChainSize.observe({ tenant_id: tenantId }, memory.chain.step_count);
            }
          } catch { }
        }

        return headerChainMemories;
      } else {
        // Fallback to single memory storage when header requirements aren't met
        logger.debug('[MemoryQdrantStore] Header-based chain failed, falling back to single memory storage');
      }
    }

    // Default behavior: each doc becomes a memory
    const uuids = normalizedDocs.map(() => crypto.randomUUID());
    const processedDocs = normalizedDocs.map(text => {
      const codeResult = this.codeBlockProcessor.processMarkdown(text);
      const enhancedText = this.codeBlockProcessor.enhanceContentForSearch(text, codeResult);
      return { original: text, enhanced: enhancedText, codeResult };
    });

    if (processedDocs.length === 0) {
      return [];
    }

    // Derive chain label from first doc and compute chain UUID
    const firstGeneratedLabel = generateLabel(processedDocs[0]!.original);
    const chainUuid = IDGenerator.generateChainUUIDv5(firstGeneratedLabel);

    // Duplicate pre-check for default path as well
    const dupReq2 = {
      filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
      limit: 256,
      with_payload: true,
      with_vector: false
    } as any;
    logger.debug(`[Qdrant][scroll-dup] collection=${this.collection} req=${JSON.stringify(dupReq2)}`);
    const dup = await this.client.scroll(this.collection, {
      filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
      limit: 256,
      with_payload: true,
      with_vector: false
    } as any);
    logger.debug(`[Qdrant][scroll-dup] result_count=${dup?.points?.length || 0}`);

    if ((dup.points?.length || 0) > 0) {
      if (!options.forceUpdate) {
        const items = (dup.points || []).map((p: any) => ({
          label: (p.payload?.label as string) || 'Memory',
          uri: `kairos://mem/${String(p.id)}`
        }));
        throw new KairosError('Duplicate memory chain', 'DUPLICATE_CHAIN', 409, { chain_id: chainUuid, items });
      }
      const delReq2 = { filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] } } as any;
      logger.debug(`[Qdrant][delete-chain] collection=${this.collection} req=${JSON.stringify(delReq2)}`);
      await this.client.delete(this.collection, delReq2);
    }

    let embeddings: any;
    try {
      embeddings = await embeddingService.generateBatchEmbeddings(processedDocs.map(p => p.enhanced));
    } catch (err) {
      logger.warn('[MemoryQdrantStore] Failed to generate embeddings for default path; falling back to zero vectors: ' + (err instanceof Error ? err.message : String(err)));
      const vectorSize = getEmbeddingDimension();
      embeddings = { embeddings: processedDocs.map(() => Array(vectorSize).fill(0)) } as any;
    }
    const currentVectorName = `vs${getEmbeddingDimension()}`;
    const memories: Memory[] = processedDocs.map((processed, index) => {
      const memory_uuid = uuids[index]!;
      const baseTags = generateTags(processed.original);
      const codeTags = processed.codeResult.allIdentifiers.slice(0, 5); // Limit to prevent tag explosion
      const allTags = [...baseTags, ...codeTags];

      const stepLabel = generateLabel(processed.original);
      return {
        memory_uuid,
        label: stepLabel, // step (document) title
        tags: allTags,
        text: processed.enhanced, // Use enhanced text with code identifiers
        llm_model_id: llmModelId,
        created_at: now.toISOString(),
        chain: {
          id: chainUuid,
          label: firstGeneratedLabel, // chain title for multi-doc path
          step_index: index + 1,
          step_count: normalizedDocs.length
        }
      };
    });

    const points = memories.map((memory, index) => {
      // classify + gem metadata
      const { task, type } = this.deriveDomainTaskType(memory.label, memory.text, memory.tags);
      const gem = knowledgeGame.calculateStepGemMetadata(
        memory.label,
        'general',
        task,
        type,
        memory.tags
      );
      return ({
        id: memory.memory_uuid,
        vector: { [currentVectorName]: embeddings.embeddings[index]! },
        payload: {
          label: memory.label,
          tags: memory.tags,
          text: memory.text,
          llm_model_id: memory.llm_model_id,
          created_at: memory.created_at,
          task,
          type,
          gem_metadata: {
            step_gem_potential: gem.step_gem_potential,
            step_quality: gem.step_quality,
            motivational_text: gem.motivational_text
          },
          // memory chain metadata (nested object)
          chain: {
            id: memory.chain!.id,
            label: memory.chain!.label,
            step_index: memory.chain!.step_index,
            step_count: memory.chain!.step_count
          }
        }
      });
    });

    // Debug: log full payload for the default path as well
    logger.tool(
      'memory-qdrant-store',
      'upsert',
      `mode=default docs=${normalizedDocs.length} collection=${this.collection} payload=${JSON.stringify({
        points
      })}`
    );

    logger.debug(`[Qdrant][upsert] collection=${this.collection} points=${points.length}`);
    await this.client.upsert(this.collection, { points });

    // Publish cache invalidation
    await redisCacheService.invalidateAfterUpdate();
    // Invalidate local in-process cache so searches see new points
    this.methods.invalidateLocalCache();

    // Update Knowledge Mining Game leaderboard for each stored memory
    for (const memory of memories) {
      try {
        const ltags = (memory.tags || []).map(t => t.toLowerCase());
        const knownTasks = new Set(['networking', 'security', 'optimization', 'troubleshooting', 'error-handling', 'installation', 'configuration', 'testing', 'deployment', 'database']);
        const task = ltags.find(t => knownTasks.has(t)) || 'general';
        const type = /```/.test(memory.text) || ltags.includes('pattern') ? 'pattern' : (ltags.includes('rule') ? 'rule' : 'context');
        const score = knowledgeGame.calculateGemScore(memory.label, task, type, memory.tags);
        await knowledgeGame.processGemDiscovery(memory.llm_model_id, score, memory.label);
        
        // Track memory store with quality
        const quality = score.quality === 'legendary' ? 'excellent' :
                       score.quality === 'rare' ? 'high' :
                       score.quality === 'quality' ? 'standard' : 'basic';
        memoryStore.inc({ quality, tenant_id: tenantId });
        
        // Track chain size
        if (memory.chain) {
          memoryChainSize.observe({ tenant_id: tenantId }, memory.chain.step_count);
        }
      } catch { }
    }

    return memories;
    } finally {
      // End duration timer
      timer({ tenant_id: tenantId });
    }
  }
}