import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { MemoryQdrantStoreMethods } from './store-methods.js';
import { memoryStoreDuration } from '../metrics/memory-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';
import { normalizeMarkdownBlob, generateLabel } from '../../utils/memory-store-utils.js';
import { storeHeaderBasedChain } from './store-chain-header-handler.js';
import { storeDefaultChain } from './store-chain-default-handler.js';
import { checkSimilarMemoryByTitle } from './store-chain-helpers.js';

export class MemoryQdrantStoreChain {
  constructor(
    private client: QdrantClient,
    private collection: string,
    private codeBlockProcessor: CodeBlockProcessor,
    private methods: MemoryQdrantStoreMethods
  ) {}

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

      // Extract label from first document for similarity check
      const firstDocLabel = generateLabel(normalizedDocs[0]!);
      
      // Check for similar memories by title before storing
      await checkSimilarMemoryByTitle(
        this.methods,
        firstDocLabel,
        options.forceUpdate || false
      );

      // Special case: if we have a single doc, try header-based slicing first.
      // If that fails, fallback to single memory storage.
      if (normalizedDocs.length === 1) {
        const markdownDoc = normalizedDocs[0]!;
        const headerChainMemories = this.methods.buildHeaderMemoryChain(markdownDoc, llmModelId, now);

        if (headerChainMemories.length > 0) {
          return await storeHeaderBasedChain(
            this.client,
            this.collection,
            this.methods,
            headerChainMemories,
            llmModelId,
            options.forceUpdate || false
          );
        } else {
          // Fallback to single memory storage when header requirements aren't met
          logger.debug('[MemoryQdrantStore] Header-based chain failed, falling back to single memory storage');
        }
      }

      // Default behavior: each doc becomes a memory
      return await storeDefaultChain(
        this.client,
        this.collection,
        this.methods,
        this.codeBlockProcessor,
        normalizedDocs,
        llmModelId,
        now,
        options.forceUpdate || false
      );
    } finally {
      // End duration timer
      timer({ tenant_id: tenantId });
    }
  }
}