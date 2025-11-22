import { logger } from '../../utils/logger.js';
import { OPENAI_API_KEY, EMBEDDING_PROVIDER, TEI_BASE_URL, TEI_MODEL, TEI_API_KEY } from '../../config.js';
import { DEFAULT_MODEL, DEFAULT_DIMENSION, OPENAI_ENDPOINT, TEI_EMBEDDING_ENDPOINT } from './config.js';

async function postEmbeddingsOpenAI(input: string[] | string): Promise<number[][]> {
    if (!OPENAI_API_KEY || !DEFAULT_MODEL) throw new Error('OpenAI requires OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL to be configured');
    const inputArray = Array.isArray(input) ? input : [input];
    const body = {
        model: DEFAULT_MODEL,
        input: inputArray,
    };
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
    };

    const res = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    const data: any = await res.json().catch((err) => {
        logger.error('[EmbeddingService] Failed to parse OpenAI response as JSON', err);
        throw new Error(`OpenAI embeddings returned non-JSON response (HTTP ${res.status})`);
    });

    if (!res.ok) {
        const errMsg = (data as any)?.error?.message || (data as any)?.message || `OpenAI embeddings HTTP ${res.status}`;
        if (res.status === 401) {
            throw new Error(`OpenAI authentication failed (401). Check OPENAI_API_KEY: ${errMsg}`);
        }
        if (res.status === 429) {
            throw new Error(`OpenAI rate limit (429): ${errMsg}`);
        }
        throw new Error(`OpenAI embeddings error (HTTP ${res.status}): ${errMsg}`);
    }

    if (!Array.isArray((data as any)?.data)) {
        logger.error('[EmbeddingService] Unexpected OpenAI response shape', data);
        throw new Error('Unexpected OpenAI embeddings response shape');
    }

    const embeddings: number[][] = (data as any).data.map((d: any) => {
        if (!Array.isArray(d?.embedding)) throw new Error('OpenAI returned invalid embedding shape');
        return d.embedding as number[];
    });

    // Basic dimension validation
    if (embeddings.length > 0 && embeddings[0]) {
        const dim = embeddings[0].length;
        if (dim !== DEFAULT_DIMENSION) {
            logger.warn(`[EmbeddingService] Embedding dimension mismatch: got ${dim}, expected ${DEFAULT_DIMENSION}`);
            throw new Error(`Embedding dimension mismatch: got ${dim}, expected ${DEFAULT_DIMENSION}`);
        }
    }

    logger.info(`[EmbeddingService] Received ${embeddings.length} embeddings (dim=${DEFAULT_DIMENSION}) [provider=openai]`);
    return embeddings;
}

async function postEmbeddingsTEI(input: string[] | string): Promise<number[][]> {
    if (!TEI_BASE_URL || !TEI_MODEL) throw new Error('TEI requires TEI_BASE_URL and TEI_MODEL to be configured');
    const inputArray = Array.isArray(input) ? input : [input];
    const body: any = { input: inputArray, model: TEI_MODEL };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (TEI_API_KEY) headers['x-api-key'] = TEI_API_KEY;

    const url = TEI_EMBEDDING_ENDPOINT || TEI_BASE_URL;
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const data: any = await res.json().catch((err) => {
        logger.error('[EmbeddingService] Failed to parse TEI response as JSON', err);
        throw new Error(`TEI embeddings returned non-JSON response (HTTP ${res.status})`);
    });

    if (!res.ok) {
        if (res.status === 401) {
            throw new Error('TEI authentication failed (401)');
        }
        if (res.status === 429) {
            throw new Error('TEI rate limit (429)');
        }
        throw new Error(`TEI embeddings error (HTTP ${res.status})`);
    }

    // Different TEI servers return different shapes; try to extract embeddings
    let embeddings: number[][] | null = null;
    if (Array.isArray((data as any)?.embeddings)) {
        embeddings = (data as any).embeddings.map((e: any) => Array.isArray(e) ? e : e?.embedding || e);
    } else if (Array.isArray((data as any)?.data)) {
        embeddings = (data as any).data.map((d: any) => d?.embedding ?? d);
    } else if (Array.isArray((data as any)?.result)) {
        embeddings = (data as any).result;
    } else if (Array.isArray(data)) {
        embeddings = data;
    }

    if (!embeddings || embeddings.length === 0 || !Array.isArray(embeddings[0])) {
        logger.error('[EmbeddingService] TEI returned unexpected embedding shape', data);
        throw new Error('TEI returned unexpected embedding shape');
    }

    // Validate dimensions
    const dim = embeddings[0].length;
    if (dim !== DEFAULT_DIMENSION) {
        logger.warn(`[EmbeddingService] TEI embedding dimension mismatch: got ${dim}, expected ${DEFAULT_DIMENSION}`);
        throw new Error(`TEI embedding dimension mismatch: got ${dim}, expected ${DEFAULT_DIMENSION}`);
    }

    logger.info(`[EmbeddingService] Received ${embeddings.length} embeddings (dim=${DEFAULT_DIMENSION}) [provider=tei]`);
    return embeddings as number[][];
}

async function postEmbeddings(input: string[] | string): Promise<number[][]> {
    // Choose provider based on explicit ENV override or auto-discovery
    const providerPref = EMBEDDING_PROVIDER; // 'auto' | 'openai' | 'tei'
    if (providerPref === 'openai') {
        if (!OPENAI_API_KEY || !DEFAULT_MODEL) throw new Error('OpenAI requires OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL to be configured');
        return await postEmbeddingsOpenAI(input);
    }
    if (providerPref === 'tei') {
        if (!TEI_BASE_URL || !TEI_MODEL) throw new Error('TEI requires TEI_BASE_URL and TEI_MODEL to be configured');
        return await postEmbeddingsTEI(input);
    }
    // Auto detection: prefer OpenAI if both OPENAI vars present, otherwise TEI
    if (OPENAI_API_KEY && DEFAULT_MODEL) {
        try {
            return await postEmbeddingsOpenAI(input);
        } catch (err) {
            logger.warn('[EmbeddingService] OpenAI failed, attempting TEI fallback: ' + (err instanceof Error ? err.message : String(err)));
            if (TEI_BASE_URL && TEI_MODEL) {
                return await postEmbeddingsTEI(input);
            }
            throw err;
        }
    }
    if (TEI_BASE_URL && TEI_MODEL) {
        return await postEmbeddingsTEI(input);
    }
    throw new Error('No embedding provider configured (OPENAI_API_KEY+OPENAI_EMBEDDING_MODEL or TEI_BASE_URL+TEI_MODEL required)');
}

export { postEmbeddings, postEmbeddingsOpenAI, postEmbeddingsTEI };