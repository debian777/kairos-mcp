/**
 * Context Engine for KAIROS Stage 2
 *
 * Tracks conversation context and provides context-aware knowledge recommendations
 * Enhances search results based on current conversation topics and session history
 */

import type { MemoryResult } from '../../types/index.js';
import type { ConversationContext, ContextualMemory, ContextualResult } from './types.js';
import {
    extractTopics,
    calculateContextRelevance,
    calculateContextScore,
    combineScores,
    generateContextReason,
    addRecentQuery,
    decayTopics
} from './utils.js';

export { ConversationContext, ContextualMemory, ContextualResult };

export class ContextEngine {
    private contextCache = new Map<string, ConversationContext>();
    private maxTopics = 10;
    private maxRecentQueries = 20;
    private contextDecayRate = 0.95; // Topics decay over time
    private relevanceThreshold = 0.3; // Minimum context relevance

    /**
     * Initialize or update conversation context
     */
    updateContext(sessionId: string, query: string, domain?: string): ConversationContext {
        let context = this.contextCache.get(sessionId);

        if (!context) {
            context = {
                sessionId,
                topics: new Map(),
                recentQueries: [],
                domainActivity: new Map(),
                timestamp: new Date(),
                messageCount: 0,
            };
        }

        // Update message count
        context.messageCount++;
        context.timestamp = new Date();

        // Extract topics from query
        const queryTopics = extractTopics(query);

        // Decay old topics BEFORE adding new ones
        decayTopics(context.topics, this.contextDecayRate);

        // Update topic relevance (after decay)
        queryTopics.forEach(topic => {
            const currentRelevance = context.topics.get(topic) || 0;
            // New topics get higher initial relevance, existing topics get boosted
            const newRelevance = Math.min(1.0, currentRelevance * 1.1 + 0.1);
            context.topics.set(topic, newRelevance);
        });

        // Add to recent queries (deduplicated)
        addRecentQuery(context.recentQueries, query, this.maxRecentQueries);

        // Update domain activity
        if (domain) {
            const currentActivity = context.domainActivity.get(domain) || 0;
            context.domainActivity.set(domain, currentActivity + 1);
        }

        // Cache updated context
        this.contextCache.set(sessionId, context);

        return context;
    }

    /**
     * Score a memory against current context
     */
    scoreMemoryWithContext(memory: MemoryResult, sessionId: string): ContextualResult {
        const context = this.contextCache.get(sessionId);

        if (!context) {
            // No context available, return original memory with neutral scoring
            return {
                memory: { ...memory, contextRelevance: 0 },
                baseScore: 1.0, // Assume perfect relevance without context
                contextScore: 0.0,
                combinedScore: 1.0,
                reason: 'No conversation context available',
                contextFactors: [],
            };
        }

        const { contextFactors } = calculateContextRelevance(memory, context);
        const contextScore = calculateContextScore(memory, context, contextFactors);
        const combinedScore = combineScores(1.0, contextScore); // Using baseScore as 1.0 for simplicity

        return {
            memory: {
                ...memory,
                contextRelevance: contextScore,
                contextualScore: combinedScore
            },
            baseScore: 1.0,
            contextScore,
            combinedScore,
            reason: generateContextReason(memory, contextFactors),
            contextFactors,
        };
    }

    /**
     * Get contextually relevant memory suggestions
     */
    getContextualSuggestions(
        memories: MemoryResult[],
        sessionId: string,
        limit: number = 5
    ): ContextualResult[] {
        const context = this.contextCache.get(sessionId);

        if (!context) {
            return memories.slice(0, limit).map(memory => ({
                memory: { ...memory, contextRelevance: 0 },
                baseScore: 1.0,
                contextScore: 0.0,
                combinedScore: 1.0,
                reason: 'No context available',
                contextFactors: [],
            }));
        }

        const contextualResults = memories.map(memory =>
            this.scoreMemoryWithContext(memory, sessionId)
        );

        // Sort by combined score (base + context)
        return contextualResults
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, limit);
    }

    /**
     * Get conversation summary for debugging/analysis
     */
    getConversationSummary(sessionId: string): any {
        const context = this.contextCache.get(sessionId);

        if (!context) {
            return { error: 'No context found for session' };
        }

        return {
            sessionId,
            messageCount: context.messageCount,
            topics: Array.from(context.topics.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([topic, score]) => ({ topic, relevance: Math.round(score * 100) / 100 })),
            recentQueries: context.recentQueries.slice(-5), // Last 5 queries
            domainActivity: Array.from(context.domainActivity.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([domain, count]) => ({ domain, messages: count })),
            lastActivity: context.timestamp,
        };
    }

    /**
     * Clear expired contexts to manage memory
     */
    cleanupExpiredContexts(maxAgeMinutes: number = 60): number {
        const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
        let clearedCount = 0;

        for (const [sessionId, context] of this.contextCache.entries()) {
            if (context.timestamp < cutoffTime) {
                this.contextCache.delete(sessionId);
                clearedCount++;
            }
        }

        return clearedCount;
    }
}

// Export singleton instance
export const contextEngine = new ContextEngine();