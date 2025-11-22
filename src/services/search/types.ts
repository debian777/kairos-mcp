/**
 * Semantic Search Service for KAIROS Stage 2 - Type Definitions
 *
 * Combines provider-agnostic embeddings with context-aware ranking for intelligent knowledge discovery
 * Replaces Stage 1's basic vector search with semantic understanding and conversation context
 */

import type { SearchMemoryParams, MemoryResult } from '../../types/index.js';

export interface SmartSearchParams extends SearchMemoryParams {
    sessionId?: string; // NEW: For context-aware results
    context?: string[]; // NEW: Current conversation context
    crossDomain?: boolean; // NEW: Cross-domain pattern matching
    minRelevance?: number; // NEW: Semantic threshold
    explanation?: boolean; // NEW: Include explanations
    bypassProtocolDetection?: boolean; // NEW: Skip protocol collapsing for direct access
}

export interface SemanticResult {
    memory: MemoryResult;
    semanticScore: number; // NEW: 0-1 semantic similarity from OpenAI
    contextScore: number; // NEW: 0-1 context relevance from conversation
    combinedScore: number; // NEW: Final weighted score
    explanation: string; // NEW: Why this match makes semantic sense
    reasoning: {
        semantic: string; // Explanation of semantic match
        context: string; // Explanation of context relevance
        overall: string; // Overall relevance explanation
    };
}

export interface SmartSearchResult {
    results: SemanticResult[];
    totalFound: number;
    searchTimeMs: number;
    queryEmbedding?: number[]; // For debugging/analysis
    contextUsed?: boolean;
    crossDomainUsed?: boolean;
    avgSemanticScore: number;
    avgContextScore: number;
}