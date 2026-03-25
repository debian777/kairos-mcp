import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/structured-logger.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { MemoryQdrantStoreMethods } from './store-methods.js';
import { memoryStoreDuration } from '../metrics/memory-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';
import { normalizeMarkdownBlob, generateLabel, parseMarkdownStructure } from '../../utils/memory-store-utils.js';
import type { ParsedFrontmatter } from '../../utils/frontmatter.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { resolveProtocolSlugCandidate } from '../../utils/protocol-slug.js';
import { KairosError } from '../../types/index.js';
import { storeHeaderBasedChain } from './store-chain-header-handler.js';
import { storeDefaultChain } from './store-chain-default-handler.js';
import { checkSimilarMemoryByTitle } from './store-chain-helpers.js';

export interface StoreChainOptions {
  forceUpdate?: boolean;
  protocolVersion?: string;
}

export class MemoryQdrantStoreChain {
  constructor(
    private client: QdrantClient,
    private collection: string,
    private codeBlockProcessor: CodeBlockProcessor,
    private methods: MemoryQdrantStoreMethods
  ) {}

  async storeChain(docs: string[], llmModelId: string, options: StoreChainOptions = {}): Promise<Memory[]> {
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

      // Docs to use for default path (each becomes a memory). Single-doc fallback uses frontmatter-stripped body.
      let docsForDefaultPath = normalizedDocs;

      // Effective protocol version: explicit option, or (for single doc) parsed from frontmatter when we fall back to default chain.
      let effectiveProtocolVersion: string | undefined = options.protocolVersion;

      let parsedSingleDoc: ParsedFrontmatter | undefined;

      // Special case: if we have a single doc, try header-based slicing first.
      // Parse frontmatter for protocol_version; use body for chain building.
      if (normalizedDocs.length === 1) {
        const markdownDoc = normalizedDocs[0]!;
        const parsed = parseFrontmatter(markdownDoc);
        parsedSingleDoc = parsed;
        const docForChain = parsed.body.length > 0 ? parsed.body : markdownDoc;
        effectiveProtocolVersion = options.protocolVersion ?? parsed.version;

        const headerChainMemories = this.methods.buildHeaderMemoryChain(docForChain, llmModelId, now);

        if (headerChainMemories.length > 0) {
          if (effectiveProtocolVersion) {
            for (const m of headerChainMemories) {
              if (m.chain) m.chain.protocol_version = effectiveProtocolVersion;
            }
          }
          const firstLabel = headerChainMemories[0]?.label || 'Knowledge Chain';
          const explicitChainLabel = headerChainMemories[0]?.chain?.label;
          const chainLabel =
            explicitChainLabel && explicitChainLabel.trim().length > 0
              ? explicitChainLabel.trim()
              : firstLabel.includes(':')
                ? firstLabel.split(':')[0]!.trim()
                : firstLabel.trim();
          const slugCand = resolveProtocolSlugCandidate(
          parsedSingleDoc?.slugRaw !== undefined ? { slugRaw: parsedSingleDoc.slugRaw } : {},
          chainLabel
        );
          if ('error' in slugCand) {
            throw new KairosError(slugCand.message, 'INVALID_SLUG', 400, { message: slugCand.message });
          }

          const chainTitleForSimilarity = (
            parsedSingleDoc?.title?.trim() || chainLabel
          ).slice(0, 120);
          const stepTitleForSimilarity = (headerChainMemories[0]?.label || '').trim().slice(0, 120);
          await checkSimilarMemoryByTitle(
            this.methods,
            chainTitleForSimilarity,
            stepTitleForSimilarity,
            options.forceUpdate || false
          );
          return await storeHeaderBasedChain(
            this.client,
            this.collection,
            this.methods,
            headerChainMemories,
            llmModelId,
            options.forceUpdate || false,
            { slug: slugCand.slug, authorSupplied: slugCand.authorSupplied }
          );
        }
        // Fallback to single memory storage when header requirements aren't met; use body only (no frontmatter in stored text).
        docsForDefaultPath = [docForChain];
        logger.debug('[MemoryQdrantStore] Header-based chain failed, falling back to single memory storage');
      }

      const doc0 = docsForDefaultPath[0]!;
      const struct0 = parseMarkdownStructure(doc0);
      const chainTitleForSimilarity = (
        parsedSingleDoc?.title?.trim() || struct0.h1 || generateLabel(doc0)
      ).slice(0, 120);
      const stepTitleForSimilarity = (struct0.h2Items[0] || '').slice(0, 120);
      await checkSimilarMemoryByTitle(
        this.methods,
        chainTitleForSimilarity,
        stepTitleForSimilarity,
        options.forceUpdate || false
      );

      // Default behavior: each doc becomes a memory (pass effectiveProtocolVersion so single-doc frontmatter fallback keeps version)
      return await storeDefaultChain(
        this.client,
        this.collection,
        this.methods,
        this.codeBlockProcessor,
        docsForDefaultPath,
        llmModelId,
        now,
        options.forceUpdate || false,
        effectiveProtocolVersion,
        parsedSingleDoc
      );
    } finally {
      // End duration timer
      timer({ tenant_id: tenantId });
    }
  }
}