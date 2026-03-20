import { logger } from '../../utils/structured-logger.js';
import {
  EMBEDDING_PROVIDER,
  OPENAI_API_KEY,
  TEI_BASE_URL,
  TEI_MODEL,
  TEI_API_KEY
} from '../../config.js';
import {
  OPENAI_EMBEDDING_MODEL,
  TEI_EMBEDDING_ENDPOINT,
  setResolvedEmbeddingDimension
} from './config.js';
import { postEmbeddingsOpenAI, postEmbeddingsTEI } from './providers.js';

export async function runEmbeddingHealthCheck(): Promise<{ healthy: boolean; message: string }> {
  try {
    const providerPref = EMBEDDING_PROVIDER;

    if (providerPref === 'openai') {
      if (!OPENAI_API_KEY || !OPENAI_EMBEDDING_MODEL) {
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

    if (OPENAI_API_KEY && OPENAI_EMBEDDING_MODEL) {
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
          setResolvedEmbeddingDimension(dim);
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

