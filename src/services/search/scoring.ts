/**
 * Semantic Search Service for KAIROS Stage 2 - Scoring Module
 *
 * Handles semantic scoring and context awareness logic
 */

import { embeddingService } from '../embedding/service.js';
import { contextEngine } from '../context/engine.js';
import type { SemanticResult } from './types.js';
import type { MemoryResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Scoring Module handles semantic similarity calculation and context-aware scoring
 */
export class SemanticScoring {
    /**
     * Calculate semantic similarity scores using embeddings
     */
    async calculateSemanticScores(memories: MemoryResult[], queryEmbedding: number[]): Promise<SemanticResult[]> {
        try {
            const results: SemanticResult[] = [];

            for (const memory of memories) {
                // For Stage 2, we'll use the stored embedding if available, or generate one
                let memoryEmbedding: number[];

                // MemoryResult doesn't have embedding property, always generate
                const memoryText = [
                    memory.description,
                    memory.content,
                    `Domain: ${memory.domain}`,
                    `Task: ${memory.task}`,
                    `Tags: ${memory.tags?.join(', ')}`
                ].filter(text => text.trim().length > 0).join('\n');

                const embeddingResult = await embeddingService.generateEmbedding(memoryText);
                memoryEmbedding = embeddingResult.embedding;

                // Calculate semantic similarity
                const semanticScore = embeddingService.calculateCosineSimilarity(queryEmbedding, memoryEmbedding);

                results.push({
                    memory,
                    semanticScore,
                    contextScore: 0, // Will be filled by context engine
                    combinedScore: semanticScore, // Initially just semantic score
                    explanation: this.generateSemanticExplanation(memory, semanticScore),
                    reasoning: {
                        semantic: this.explainSemanticMatch(memory, semanticScore),
                        context: 'No context provided',
                        overall: this.generateOverallExplanation(semanticScore, 0, 'semantic'),
                    },
                });
            }

            return results;

        } catch (error) {
            logger.error('Failed to calculate semantic scores', error instanceof Error ? error : new Error(String(error)));
            // Return basic results without semantic scoring
            return memories.map(memory => ({
                memory,
                semanticScore: 0.5, // Neutral score
                contextScore: 0,
                combinedScore: 0.5,
                explanation: 'Semantic scoring unavailable',
                reasoning: {
                    semantic: 'Unable to calculate semantic similarity',
                    context: 'No context provided',
                    overall: 'Fallback to neutral scoring',
                },
            }));
        }
    }

    /**
     * Apply context awareness to semantic results
     */
    applyContextAwareness(semanticResults: SemanticResult[], sessionId: string): SemanticResult[] {
        return semanticResults.map(result => {
            const contextualResult = contextEngine.scoreMemoryWithContext(result.memory, sessionId);

            // Update with context information
            return {
                ...result,
                contextScore: contextualResult.contextScore,
                combinedScore: this.combineScores(result.semanticScore, contextualResult.contextScore),
                explanation: `${result.explanation}\n\nContext: ${contextualResult.reason}`,
                reasoning: {
                    ...result.reasoning,
                    context: contextualResult.reason,
                    overall: this.generateOverallExplanation(result.semanticScore, contextualResult.contextScore, 'combined'),
                },
            };
        });
    }

    /**
     * Apply cross-domain pattern matching
     */
    async applyCrossDomainMatching(query: string): Promise<SemanticResult[]> {
        // For Stage 2, this is a simplified implementation
        // In Stage 3, this would use more sophisticated cross-domain algorithms

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
        const crossDomainResults: SemanticResult[] = [];

        for (const domain of relatedDomains.slice(0, 2)) { // Limit to 2 domains for performance
            try {
                // This would need to be passed in from the main service
                // For now, return placeholder results
                logger.info(`Cross-domain matching for domain: ${domain}`);

                // In real implementation, this would call back to the main service
                // but we'll handle that in the main service for now
                
            } catch (error) {
                logger.error(`Cross-domain search failed for ${domain}`, error instanceof Error ? error : new Error(String(error)));
            }
        }

        return crossDomainResults;
    }

    /**
     * Merge semantic results with cross-domain results
     */
    mergeResults(semanticResults: SemanticResult[], crossDomainResults: SemanticResult[]): SemanticResult[] {
        // Combine and deduplicate by memory ID
        const allResults = [...semanticResults, ...crossDomainResults];
        const uniqueResults = new Map<string, SemanticResult>();

        for (const result of allResults) {
            const existing = uniqueResults.get(result.memory.id);
            if (!existing || result.combinedScore > existing.combinedScore) {
                uniqueResults.set(result.memory.id, result);
            }
        }

        return Array.from(uniqueResults.values());
    }

    /**
     * Combine semantic and context scores with intelligent weighting
     */
    combineScores(semanticScore: number, contextScore: number): number {
        // Dynamic weighting based on scores
        const semanticWeight = semanticScore > 0.7 ? 0.8 : 0.6;
        const contextWeight = 1.0 - semanticWeight;

        return semanticScore * semanticWeight + contextScore * contextWeight;
    }

    /**
     * Generate semantic explanation for a match
     */
    private generateSemanticExplanation(memory: MemoryResult, score: number): string {
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
    private explainSemanticMatch(memory: MemoryResult, score: number): string {
        const matchStrength = score > 0.7 ? 'strong' : score > 0.5 ? 'moderate' : 'weak';
        return `This knowledge shows ${matchStrength} semantic similarity to your query in the ${memory.domain} domain.`;
    }

    /**
     * Generate overall explanation
     */
    private generateOverallExplanation(semanticScore: number, contextScore: number, mode: string): string {
        if (mode === 'semantic') {
            return `Relevance based purely on semantic understanding of your query.`;
        } else {
            const semanticWeight = Math.round(semanticScore * 100);
            const contextWeight = Math.round(contextScore * 100);
            return `Combined relevance: ${semanticWeight}% semantic + ${contextWeight}% contextual = intelligent match.`;
        }
    }
}