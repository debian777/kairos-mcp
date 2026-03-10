import { logger } from '../../utils/logger.js';
import { OPENAI_EMBEDDING_MODEL, OPENAI_API_KEY, OPENAI_API_URL, TEI_BASE_URL } from '../../config.js';

export { OPENAI_EMBEDDING_MODEL };
export const OPENAI_ENDPOINT = `${OPENAI_API_URL}/v1/embeddings`;

// TEI (Text Embeddings Inference) configuration
export const TEI_EMBEDDING_ENDPOINT = TEI_BASE_URL
    ? (TEI_BASE_URL.endsWith('/') ? TEI_BASE_URL.slice(0, -1) : TEI_BASE_URL) + '/v1/embeddings'
    : '';

/** Runtime cache for embedding dimension (set by first successful embed; validated on subsequent calls). */
let _resolvedDimension: number | null = null;

/** Set embedding dimension from first API response; on subsequent calls asserts same value. */
export function setResolvedEmbeddingDimension(dim: number): void {
    if (_resolvedDimension !== null && _resolvedDimension !== dim) {
        throw new Error(`Embedding dimension mismatch: got ${dim}, expected ${_resolvedDimension}`);
    }
    _resolvedDimension = dim;
}

/** Return cached dimension; throws if not yet resolved (probe must run at startup). */
export function getResolvedEmbeddingDimension(): number {
    if (_resolvedDimension === null) {
        throw new Error(
            'Embedding dimension not resolved. Ensure probeEmbeddingDimension() runs at startup before using Qdrant store or embedding-dependent code.'
        );
    }
    return _resolvedDimension;
}

/** Public API for dimension (same as getResolvedEmbeddingDimension after probe). */
export function getEmbeddingDimension(): number {
    return getResolvedEmbeddingDimension();
}

if (!OPENAI_API_KEY) {
    logger.debug('OPENAI_API_KEY not configured; OpenAI usage will be disabled unless explicitly requested.');
}