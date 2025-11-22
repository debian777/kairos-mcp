import { logger } from '../../utils/logger.js';
import { OPENAI_EMBEDDING_MODEL, getEmbeddingDimension, OPENAI_API_KEY, TEI_BASE_URL } from '../../config.js';

export const DEFAULT_MODEL = OPENAI_EMBEDDING_MODEL;
export const DEFAULT_DIMENSION = getEmbeddingDimension();
export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/embeddings';

// TEI (Text Embeddings Inference) configuration
export const TEI_EMBEDDING_ENDPOINT = TEI_BASE_URL
    ? (TEI_BASE_URL.endsWith('/') ? TEI_BASE_URL.slice(0, -1) : TEI_BASE_URL) + '/v1/embeddings'
    : '';

if (!OPENAI_API_KEY) {
    logger.debug('OPENAI_API_KEY not configured; OpenAI usage will be disabled unless explicitly requested.');
}