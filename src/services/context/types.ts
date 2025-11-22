import type { MemoryResult } from '../../types/index.js';

export interface ConversationContext {
    sessionId: string;
    topics: Map<string, number>; // topic -> relevance score (0-1)
    recentQueries: string[];
    domainActivity: Map<string, number>; // domain -> activity score
    timestamp: Date;
    messageCount: number;
}

export interface ContextualMemory extends MemoryResult {
    contextRelevance?: number; // How relevant this memory is to current context
    contextualScore?: number; // Dynamic score based on context
}

export interface ContextualResult {
    memory: ContextualMemory;
    baseScore: number; // Original semantic similarity
    contextScore: number; // Context-based relevance
    combinedScore: number; // Final combined score
    reason: string; // Why this match is contextually relevant
    contextFactors: string[]; // What context factors contributed to this match
}