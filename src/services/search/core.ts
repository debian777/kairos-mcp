/**
 * Semantic Search Service for KAIROS Stage 2 - Core Service
 *
 * Main orchestrator for semantic search operations
 */

import { embeddingService } from '../embedding/service.js';
import { contextEngine } from '../context/engine.js';
import type { SmartSearchParams, SmartSearchResult, SemanticResult } from './types.js';
import type { MemoryResult } from '../../types/index.js';
import { QdrantService } from '../qdrant/service.js';
import { logger } from '../../utils/logger.js';
import { ChainProcessor } from './chain-processor.js';
import { SemanticScoring } from './scoring.js';
import { SemanticSearchUtils } from './utils.js';

/**
 * Core Semantic Search Service orchestrating all search operations
 */
export class SemanticSearchCore {
    private qdrantService: QdrantService;
    private chainProcessor: ChainProcessor;
    private semanticScoring: SemanticScoring;

    constructor(qdrantService: QdrantService) {
        this.qdrantService = qdrantService;
        this.chainProcessor = new ChainProcessor();
        this.semanticScoring = new SemanticScoring();
    }

    /**
     * Perform smart search with semantic understanding and context awareness
     */
    async smartSearch(params: SmartSearchParams): Promise<SmartSearchResult> {
        logger.info(`Starting smartSearch with query: "${params.query}" domain: ${params.domain || 'all'} limit: ${params.limit || 10}`);
        const startTime = Date.now();

        try {
            // 1. Generate query embedding using configured provider
            logger.info(`Generating embedding for query: "${params.query}"`);
            const queryEmbeddingResult = await embeddingService.generateEmbedding(params.query);
            const queryEmbedding = queryEmbeddingResult.embedding;
            logger.info(`Generated embedding with ${queryEmbedding.length} dimensions`);

            // 2. Get initial results from Qdrant with basic vector search
            const initialResults = await this.getInitialResults(params);

            if (initialResults.length === 0) {
                return {
                    results: [],
                    totalFound: 0,
                    searchTimeMs: Date.now() - startTime,
                    queryEmbedding,
                    contextUsed: false,
                    crossDomainUsed: false,
                    avgSemanticScore: 0,
                    avgContextScore: 0,
                };
            }

            // 3. Calculate semantic scores for all results
            const semanticResults = await this.semanticScoring.calculateSemanticScores(initialResults, queryEmbedding);

            // 4. Apply context-aware scoring if session ID provided
            let contextAwareResults = semanticResults;
            let contextUsed = false;

            if (params.sessionId) {
                contextEngine.updateContext(params.sessionId, params.query, params.domain);
                contextAwareResults = this.semanticScoring.applyContextAwareness(semanticResults, params.sessionId);
                contextUsed = true;
            }

            // 5. Apply memory-chain detection and collapsing (unless bypassed)
            let collapsedResults = contextAwareResults;
            if (!params.bypassProtocolDetection) {
                const groups = this.chainProcessor.detectMemoryChainGroups(contextAwareResults);
                collapsedResults = this.chainProcessor.collapseMemoryChainGroups(contextAwareResults, groups);
            }

            // 6. Apply cross-domain matching if requested
            let finalResults = collapsedResults;
            let crossDomainUsed = false;

            if (params.crossDomain && !params.domain) {
                const limit = params.limit || 10;
                const crossDomainResults = await this.applyCrossDomainMatching(params.query, limit);
                finalResults = this.semanticScoring.mergeResults(collapsedResults, crossDomainResults);
                crossDomainUsed = true;
            }

            // 7. Sort by combined score and apply relevance threshold
            const filteredResults = SemanticSearchUtils.filterAndSortResults(
                finalResults,
                params.minRelevance || 0.1,
                params.limit || 10
            ) as SemanticResult[];

            // 8. Calculate statistics
            const { avgSemanticScore, avgContextScore } = SemanticSearchUtils.calculateAverageScore(filteredResults);

            return {
                results: filteredResults,
                totalFound: filteredResults.length,
                searchTimeMs: Date.now() - startTime,
                queryEmbedding,
                contextUsed,
                crossDomainUsed,
                avgSemanticScore,
                avgContextScore,
            };

        } catch (error) {
            logger.error('Smart search failed', error instanceof Error ? error : new Error(String(error)));
            throw new Error(`Smart search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get initial results from Qdrant using vector similarity
     */
    private async getInitialResults(params: SmartSearchParams): Promise<MemoryResult[]> {
        try {
            const qdrantParams: any = {
                query: params.query,
                domain: params.domain,
                limit: (params.limit || 10) * 3, // Get more results for better filtering
            };

            logger.info(`Searching Qdrant with query: "${qdrantParams.query}" domain: ${qdrantParams.domain || 'all'} limit: ${qdrantParams.limit}`);
            const results = await this.qdrantService.searchMemory(qdrantParams.query, qdrantParams.limit, qdrantParams.domain);
            logger.info(`Qdrant returned ${results.length} results`);

            // Convert MemoryResult back to MemoryResult for processing
            const memories = results.map(result => {
                const memory: MemoryResult = {
                    id: result.id,
                    domain: result.domain,
                    task: result.task,  // Preserve task from database (Qdrant provides fallback)
                    type: result.type,  // Preserve type from database
                    tags: result.tags,  // Preserve tags from database
                    description: result.description || 'No description',
                    content: result.content,
                    relevance: result.relevance,
                    created_at: result.created_at,
                    confidence: result.confidence,
                    ...(result.protocol && { protocol: result.protocol }), // Include protocol metadata only if present!
                };

                return memory;
            });

            // Log protocol detection summary
            const protocolMemories = memories.filter(m => m.protocol);
            logger.info(`Protocol detection: ${protocolMemories.length}/${memories.length} memories have protocol metadata`);

            return memories;

        } catch (error) {
            logger.error('Failed to get initial results', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    /**
     * Apply cross-domain pattern matching
     */
    private async applyCrossDomainMatching(query: string, limit: number): Promise<any[]> {
        const queryWords = query.toLowerCase().split(/\s+/);
        const potentialDomains = ['docker', 'typescript', 'mcp', 'ai'];

        // Find related domains based on query
        const relatedDomains = potentialDomains.filter(domain =>
            queryWords.some(word => domain.includes(word) || word.includes(domain))
        );

        if (relatedDomains.length === 0) {
            return [];
        }

        // Search in related domains
        const crossDomainResults: any[] = [];

        for (const domain of relatedDomains.slice(0, 2)) { // Limit to 2 domains for performance
            try {
                const domainResults = await this.smartSearch({
                    query,
                    domain,
                    limit: Math.ceil(limit / 2),
                });

                crossDomainResults.push(...domainResults.results.map(result => ({
                    ...result,
                    explanation: `${result.explanation}\n\nCross-domain: Related to ${domain}`,
                })));

            } catch (error) {
                logger.error(`Cross-domain search failed for ${domain}`, error instanceof Error ? error : new Error(String(error)));
            }
        }

        return crossDomainResults;
    }

    /**
     * Collapse memory chain entries from external callers.
     * Accepts already-constructed SemanticResult[] and returns collapsed results.
     */
    public collapseMemoryChainResults(results: any[]): any[] {
        return this.chainProcessor.collapseMemoryChainResults(results);
    }

    /**
     * Get search analytics for debugging and optimization
     */
    async getSearchAnalytics(sessionId: string): Promise<any> {
        const contextSummary = contextEngine.getConversationSummary(sessionId);
        const embeddingConfig = embeddingService.getConfig();

        return {
            session: contextSummary,
            embedding: embeddingConfig,
            timestamp: new Date(),
        };
    }
}