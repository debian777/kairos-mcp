import type { MemoryResult } from '../../types/index.js';
import type { ConversationContext } from './types.js';

/**
 * Extract topics from a query using simple keyword extraction
 */
export function extractTopics(query: string): string[] {
    const words = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3); // Only words longer than 3 characters

    // Filter out common stop words
    const stopWords = new Set([
        'that', 'this', 'with', 'from', 'they', 'have', 'been', 'were',
        'will', 'would', 'could', 'should', 'what', 'when', 'where',
        'which', 'while', 'their', 'there', 'these', 'those', 'about'
    ]);

    return words.filter((word: string) => !stopWords.has(word));
}

/**
 * Calculate how relevant a memory is to current context
 */
export function calculateContextRelevance(memory: MemoryResult, context: ConversationContext) {
    const factors: string[] = [];
    let relevance = 0;

    // Check resource/domain relevance
    const domainRelevance = context.domainActivity.get(memory.domain) || 0;
    if (domainRelevance > 0) {
        relevance += 0.3;
        factors.push(`domain: ${memory.domain}`);
    }

    // Check tag relevance
    const memoryTags = new Set<string>(memory.tags || []);
    const topicMatches = Array.from(context.topics.entries())
        .filter(([topic]) =>
            memoryTags.has(topic) || tagMatchesTopic(memoryTags, topic)
        )
        .sort((a, b) => b[1] - a[1]); // Sort by relevance

    if (topicMatches.length > 0) {
        relevance += 0.4;
        factors.push(`topics: ${topicMatches.slice(0, 3).map(([t]) => t).join(', ')}`);
    }

    // Check task relevance
    const taskWords: string[] = memory.task?.toLowerCase().split(/\s+/) || [];
    const taskMatches = taskWords.filter((word: string) =>
        Array.from(context.topics.keys()).includes(word)
    );

    if (taskMatches.length > 0) {
        relevance += 0.2;
        factors.push(`task: ${taskMatches.join(', ')}`);
    }

    // Check type relevance
    const typeRelevance = getTypeRelevance(memory.type);
    if (typeRelevance > 0) {
        relevance += 0.1;
        factors.push(`type: ${memory.type}`);
    }

    return { baseScore: relevance, contextFactors: factors };
}

/**
 * Calculate final context score
 */
export function calculateContextScore(
    memory: MemoryResult,
    context: ConversationContext,
    factors: string[]
): number {
    if (factors.length === 0) return 0;

    // Base score from relevance calculation
    let score = 0.3; // Base score for any context match

    // Boost score based on number of matching factors
    score += factors.length * 0.1;

    // Boost for domain matches (they're usually more important)
    if (factors.some(f => f.startsWith('domain:'))) {
        score += 0.2;
    }

    // Boost for recent queries that mention this memory
    const queryMatches = context.recentQueries.filter(query =>
        queryMatchesMemory(query, memory)
    );
    score += queryMatches.length * 0.05;

    return Math.min(1.0, score);
}

/**
 * Combine base semantic score with context score
 */
export function combineScores(baseScore: number, contextScore: number): number {
    // Weight: 70% semantic, 30% context
    return baseScore * 0.7 + contextScore * 0.3;
}

/**
 * Generate human-readable reason for context relevance
 */
export function generateContextReason(memory: MemoryResult, factors: string[]): string {
    if (factors.length === 0) {
        return 'No specific contextual relevance found';
    }

    const mainFactor = factors[0];
    if (!mainFactor) {
        return 'Contextually relevant based on your conversation';
    }

    if (mainFactor.startsWith('domain:')) {
        return `Relevant because you've been discussing ${memory.domain} topics`;
    } else if (mainFactor.startsWith('topics:')) {
        return `Matches your current discussion topics`;
    } else if (mainFactor.startsWith('task:')) {
        return `Related to your current focus area`;
    } else {
        return `Contextually relevant based on your conversation`;
    }
}

/**
 * Check if a query matches a memory (simple keyword matching)
 */
export function queryMatchesMemory(query: string, memory: MemoryResult): boolean {
    const queryWords = query.toLowerCase().split(/\s+/);
    const memoryText = [
        memory.description,
        memory.domain,
        memory.task,
        ...(memory.tags || [])
    ].join(' ').toLowerCase();

    return queryWords.some(word =>
        word.length > 3 && memoryText.includes(word)
    );
}

/**
 * Check if tags match a topic (simple substring matching)
 */
export function tagMatchesTopic(tags: Set<string>, topic: string): boolean {
    return Array.from(tags).some(tag =>
        tag.includes(topic) || topic.includes(tag)
    );
}

/**
 * Get relevance based on memory type
 */
export function getTypeRelevance(type: string | undefined): number {
    // Rules are more contextually relevant than general patterns
    if (type === 'rule') return 0.8;
    if (type === 'pattern') return 0.6;
    if (type === 'context') return 0.4;
    if (type === 'snippet') return 0.3;
    return 0.1;
}

/**
 * Add query to recent queries with deduplication
 */
export function addRecentQuery(recentQueries: string[], query: string, maxRecentQueries: number): void {
    const trimmed = query.trim();
    if (!recentQueries.includes(trimmed)) {
        recentQueries.push(trimmed);
        // Keep only the most recent queries
        while (recentQueries.length > maxRecentQueries) {
            recentQueries.shift();
        }
    }
}

/**
 * Decay old topics to prevent over-representation
 */
export function decayTopics(topics: Map<string, number>, contextDecayRate: number): void {
    for (const [topic, relevance] of topics.entries()) {
        const decayedRelevance = relevance * contextDecayRate;
        if (decayedRelevance < 0.1) {
            topics.delete(topic); // Remove very low relevance topics
        } else {
            topics.set(topic, decayedRelevance);
        }
    }
}