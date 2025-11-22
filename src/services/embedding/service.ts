/**
 * Embedding Service using OpenAI embeddings
 *
 * Implements pure OpenAI embedding support.
 * Uses environment variables:
 *  - OPENAI_API_KEY
 *  - OPENAI_EMBEDDING_MODEL
 *  - EMBEDDING_DIMENSION
 *
 * Supports OpenAI and TEI (Text Embeddings Inference) providers. Selection:
 *  - If OPENAI_API_KEY is set, OpenAI is used.
 *  - Otherwise, TEI_BASE_URL + TEI_MODEL will be used if configured.
 */

import { logger } from '../../utils/logger.js';
import { EMBEDDING_PROVIDER, OPENAI_API_KEY, TEI_BASE_URL, TEI_MODEL, TEI_API_KEY } from '../../config.js';
import { DEFAULT_MODEL, DEFAULT_DIMENSION, TEI_EMBEDDING_ENDPOINT } from './config.js';
import { postEmbeddings, postEmbeddingsOpenAI, postEmbeddingsTEI } from './providers.js';
import type { EmbeddingResult, BatchEmbeddingResult } from './types.js';

// Re-export types
export type { EmbeddingResult, BatchEmbeddingResult } from './types.js';

export class EmbeddingService {
    private readonly embeddingDimension: number;

    constructor() {
        this.embeddingDimension = DEFAULT_DIMENSION;
    }

    async generateEmbedding(text: string): Promise<EmbeddingResult> {
        if (!text || text.trim().length === 0) throw new Error('Text cannot be empty for embedding generation');
        const vectors = await postEmbeddings(text.trim());
        const embedding = vectors?.[0];
        if (!Array.isArray(embedding)) throw new Error('OpenAI returned no embedding');
        if (embedding.length !== this.embeddingDimension) throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${this.embeddingDimension}`);
        return {
            embedding,
            model: DEFAULT_MODEL,
            usage: { prompt_tokens: 0, total_tokens: 0 },
        };
    }

    async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
        const valid = texts.filter(t => t && t.trim().length > 0);
        if (valid.length === 0) throw new Error('No valid texts provided for batch embedding');
        const vectors = await postEmbeddings(valid);
        // Validate each vector length
        const wrongDim = vectors.some(v => !Array.isArray(v) || v.length !== this.embeddingDimension);
        if (wrongDim) {
            logger.error('[EmbeddingService] One or more embeddings returned with unexpected dimension');
            throw new Error('One or more embeddings have unexpected dimension from OpenAI');
        }
        return {
            embeddings: vectors,
            model: DEFAULT_MODEL,
            usage: { prompt_tokens: 0, total_tokens: 0 },
        };
    }

    calculateCosineSimilarity(embedding1: number[] | undefined, embedding2: number[] | undefined): number {
        if (!embedding1 || !embedding2) return 0;
        if (embedding1.length !== embedding2.length) throw new Error('Embeddings must have the same dimensions');
        let dot = 0, n1 = 0, n2 = 0;
        for (let i = 0; i < embedding1.length; i++) {
            const a = embedding1[i] || 0;
            const b = embedding2[i] || 0;
            dot += a * b; n1 += a * a; n2 += b * b;
        }
        const mag = Math.sqrt(n1) * Math.sqrt(n2);
        return mag === 0 ? 0 : dot / mag;
    }

    async generateMemoryEmbedding(memory: any): Promise<number[]> {
        const textToEmbed = [
            (memory as any)?.content || '',
            `Resource: ${(memory as any)?.resource || ''}`,
            `Task: ${(memory as any)?.task || ''}`,
            `Tags: ${((memory as any)?.tags || []).join(', ')}`,
            `Type: ${(memory as any)?.type || ''}`
        ].filter(text => text.trim().length > 0).join('\n');

        const result = await this.generateEmbedding(textToEmbed);
        return result.embedding;
    }

    estimateCost(): number {
        // Cost estimation could be added later; return 0 for now.
        return 0;
    }

    async healthCheck(): Promise<{ healthy: boolean; message: string }> {
        try {
            const providerPref = EMBEDDING_PROVIDER;

            if (providerPref === 'openai') {
                // Explicit OpenAI only - enforce duo
                if (!OPENAI_API_KEY || !DEFAULT_MODEL) {
                    return { healthy: false, message: 'OpenAI requires OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL' };
                }
                try {
                    const res = await postEmbeddingsOpenAI('health check');
                    return { healthy: Array.isArray(res) && res.length > 0, message: 'openai embeddings operational' };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    if (msg.includes('429')) return { healthy: true, message: 'openai is rate-limited (429) - reachable but throttled' };
                    if (msg.includes('401') || msg.toLowerCase().includes('authentication')) return { healthy: false, message: 'openai authentication failed - check OPENAI_API_KEY' };
                    return { healthy: false, message: `openai health check failed: ${msg}` };
                }
            }

            if (providerPref === 'tei') {
                // Explicit TEI only - enforce duo
                if (!TEI_BASE_URL || !TEI_MODEL) {
                    return { healthy: false, message: 'TEI requires TEI_BASE_URL and TEI_MODEL' };
                }
                try {
                    const res = await postEmbeddingsTEI('health check');
                    return { healthy: Array.isArray(res) && res.length > 0, message: 'TEI embeddings operational' };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    if (msg.includes('401')) return { healthy: false, message: 'TEI authentication failed (401)' };
                    if (msg.includes('429')) return { healthy: true, message: 'TEI is rate-limited (429) - reachable but throttled' };
                    return { healthy: false, message: `TEI health check failed: ${msg}` };
                }
            }

            // Auto mode: prefer OpenAI if both OPENAI vars are present, otherwise TEI
            if (OPENAI_API_KEY && DEFAULT_MODEL) {
                try {
                    const res = await postEmbeddingsOpenAI('health check');
                    return { healthy: Array.isArray(res) && res.length > 0, message: 'openai embeddings operational' };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger.warn(`[EmbeddingService] OpenAI health check failed, trying TEI fallback: ${msg}`);
                }
            }

            if (TEI_BASE_URL && TEI_MODEL) {
                try {
                    const url = TEI_EMBEDDING_ENDPOINT || TEI_BASE_URL;
                    const payload = { model: TEI_MODEL, input: ['health check'] };
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (TEI_API_KEY) headers['x-api-key'] = TEI_API_KEY;

                    const resp = await fetch(url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(payload)
                    });

                    let data: any = null;
                    try {
                        data = await resp.json();
                    } catch (parseErr) {
                        logger.warn(`[EmbeddingService] TEI returned non-JSON response: ${String(parseErr)}`);
                    }

                    if (!resp.ok) {
                        if (resp.status === 401) {
                            return { healthy: false, message: 'TEI authentication failed (401)' };
                        }
                        if (resp.status === 429) {
                            return { healthy: true, message: 'TEI is rate-limited (429) - reachable but throttled' };
                        }
                        return { healthy: false, message: `TEI returned HTTP ${resp.status}` };
                    }

                    // Accept several TEI response shapes:
                    // - { embeddings: [ [..], ... ] }
                    // - { data: [ { embedding: [...] }, ... ] }
                    // - { result: [ ... ] } (some servers)
                    let embeddings: any = null;
                    if (Array.isArray(data?.embeddings)) {
                        embeddings = data.embeddings;
                    } else if (Array.isArray(data?.data)) {
                        embeddings = data.data.map((d: any) => d?.embedding ?? d);
                    } else if (Array.isArray(data?.result)) {
                        embeddings = data.result;
                    } else if (Array.isArray(data)) {
                        embeddings = data;
                    }

                    if (Array.isArray(embeddings) && embeddings.length > 0 && Array.isArray(embeddings[0])) {
                        const dim = embeddings[0].length;
                        if (dim !== DEFAULT_DIMENSION) {
                            // If env explicitly sets EMBEDDING_DIMENSION, validate against it
                            logger.warn(`[EmbeddingService] TEI embedding dimension mismatch: got ${dim}, expected ${DEFAULT_DIMENSION}`);
                            return { healthy: false, message: `TEI embedding dimension mismatch: got ${dim}, expected ${DEFAULT_DIMENSION}` };
                        }
                        return { healthy: true, message: 'TEI embeddings operational' };
                    }

                    return { healthy: false, message: 'TEI returned unexpected embedding shape or no embeddings' };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    return { healthy: false, message: `TEI health check error: ${msg}` };
                }
            }

            return { healthy: false, message: 'No embedding provider configured (set OPENAI_API_KEY+OPENAI_EMBEDDING_MODEL or TEI_BASE_URL+TEI_MODEL)' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { healthy: false, message: `Embedding health check error: ${msg}` };
        }
    }

    getConfig() {
        let provider: 'openai' | 'tei' | 'none' = 'none';
        const pref = EMBEDDING_PROVIDER;
        if (pref === 'openai') provider = 'openai';
        else if (pref === 'tei') provider = 'tei';
        else if (OPENAI_API_KEY && DEFAULT_MODEL) provider = 'openai';
        else if (TEI_BASE_URL && TEI_MODEL) provider = 'tei';

        return {
            model: provider === 'openai' ? DEFAULT_MODEL : (TEI_MODEL || DEFAULT_MODEL),
            dimension: this.embeddingDimension,
            provider,
            apiKeyConfigured: !!OPENAI_API_KEY && !!DEFAULT_MODEL,
            teiConfigured: !!TEI_BASE_URL && !!TEI_MODEL,
            providerPref: EMBEDDING_PROVIDER
        };
    }
}

export const embeddingService = new EmbeddingService();
