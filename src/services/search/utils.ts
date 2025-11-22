/**
 * Semantic Search Service for KAIROS Stage 2 - Utilities
 *
 * Contains utility functions for explanation generation and other helper methods
 */

import type { MemoryResult } from '../../types/index.js';

/**
 * Utility functions for semantic search operations
 */
export class SemanticSearchUtils {
    /**
     * Generate semantic explanation for a match
     */
    static generateSemanticExplanation(memory: MemoryResult, score: number): string {
        if (score > 0.8) {
            return `Strong semantic match (${Math.round(score * 100)}%): ${memory.description}`;
        } else if (score > 0.6) {
            return `Good semantic match (${Math.round(score * 100)}%): ${memory.description}`;
        } else if (score > 0.4) {
            return `Moderate semantic match (${Math.round(score * 100)}%): ${memory.description}`;
        } else {
            return `Weak semantic match (${Math.round(score * 100)}%): ${memory.description}`;
        }
    }

    /**
     * Explain semantic match details
     */
    static explainSemanticMatch(memory: MemoryResult, score: number): string {
        const matchStrength = score > 0.7 ? 'strong' : score > 0.5 ? 'moderate' : 'weak';
        return `This knowledge shows ${matchStrength} semantic similarity to your query in the ${memory.domain} domain.`;
    }

    /**
     * Generate overall explanation
     */
    static generateOverallExplanation(semanticScore: number, contextScore: number, mode: string): string {
        if (mode === 'semantic') {
            return `Relevance based purely on semantic understanding of your query.`;
        } else {
            const semanticWeight = Math.round(semanticScore * 100);
            const contextWeight = Math.round(contextScore * 100);
            return `Combined relevance: ${semanticWeight}% semantic + ${contextWeight}% contextual = intelligent match.`;
        }
    }

    /**
     * Calculate average score from array of results
     */
    static calculateAverageScore(results: { semanticScore?: number; contextScore?: number }[]): {
        avgSemanticScore: number;
        avgContextScore: number;
    } {
        const avgSemanticScore = results.length > 0
            ? results.reduce((sum, r) => sum + (r.semanticScore || 0), 0) / results.length
            : 0;

        const avgContextScore = results.length > 0
            ? results.reduce((sum, r) => sum + (r.contextScore || 0), 0) / results.length
            : 0;

        return { avgSemanticScore, avgContextScore };
    }

    /**
     * Filter results by minimum relevance score and sort
     */
    static filterAndSortResults<T extends { combinedScore: number }>(
        results: T[],
        minRelevance: number,
        limit: number
    ): T[] {
        return results
            .filter(result => result.combinedScore >= minRelevance)
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, limit);
    }

    /**
     * Safe extraction of memory text for embedding generation
     */
    static extractMemoryText(memory: MemoryResult): string {
        return [
            memory.description,
            memory.content,
            `Domain: ${memory.domain}`,
            `Task: ${memory.task}`,
            `Tags: ${memory.tags?.join(', ')}`
        ].filter(text => text && text.trim().length > 0).join('\n');
    }
}