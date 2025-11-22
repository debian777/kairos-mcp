/**
 * Semantic Search Service for KAIROS Stage 2 - Main Entry Point
 *
 * Combines provider-agnostic embeddings with context-aware ranking for intelligent knowledge discovery
 * Replaces Stage 1's basic vector search with semantic understanding and conversation context
 *
 * This file serves as the main entry point and re-exports all types and classes from the modular structure.
 */

export type { 
    SmartSearchParams, 
    SemanticResult, 
    SmartSearchResult 
} from './types.js';

export { ChainProcessor } from './chain-processor.js';
export { SemanticScoring } from './scoring.js';
export { SemanticSearchUtils } from './utils.js';
export { SemanticSearchCore } from './core.js';

/**
 * Main Semantic Search Service class for backward compatibility
 * Delegates to SemanticSearchCore internally
 */
import { SemanticSearchCore } from './core.js';
import { QdrantService } from '../qdrant/service.js';
import type { SmartSearchParams, SmartSearchResult, SemanticResult } from './types.js';

export class SemanticSearchService {
    private coreService: SemanticSearchCore;

    constructor(qdrantService: QdrantService) {
        this.coreService = new SemanticSearchCore(qdrantService);
    }

    /**
     * Perform smart search with semantic understanding and context awareness
     */
    async smartSearch(params: SmartSearchParams): Promise<SmartSearchResult> {
        return this.coreService.smartSearch(params);
    }

    /**
     * Collapse memory chain entries from external callers.
     * Accepts already-constructed SemanticResult[] and returns collapsed results.
     */
    public collapseMemoryChainResults(results: SemanticResult[]): SemanticResult[] {
        return this.coreService.collapseMemoryChainResults(results);
    }

    /**
     * Get search analytics for debugging and optimization
     */
    async getSearchAnalytics(sessionId: string): Promise<any> {
        return this.coreService.getSearchAnalytics(sessionId);
    }
}