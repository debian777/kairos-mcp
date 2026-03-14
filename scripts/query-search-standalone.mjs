#!/usr/bin/env node
/**
 * Run the same Query API (prefetch + RRF + formula) as the app, without starting the app.
 * Use to experiment with formula/filters and see scores without redeploying.
 *
 * Usage (from repo root, .env with QDRANT_* and OPENAI_*):
 *   npm run query-search -- "your query"
 *   npm run query-search -- "query" --dense-only
 *   npm run query-search -- "query" --limit 50
 *   SEARCH_SPACE_IDS=id1,id2 npm run query-search -- "query"
 *
 * To see attest_boost in results, run once: npm run backfill:attest-boost
 */
import 'dotenv/config';

const QDRANT_URL = (process.env.QDRANT_URL || '').replace(/\/$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'kairos';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() || '';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_API_URL = (process.env.OPENAI_API_URL || 'https://api.openai.com').replace(/\/$/, '');

const REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';
const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
const TITLE_BOOST = 0.5;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const denseOnly = process.argv.includes('--dense-only');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx >= 0 && process.argv[limitIdx + 1] ? Math.max(1, parseInt(process.argv[limitIdx + 1], 10) || 20) : 20;
const query = args[0] || 'ELITE AI CODING STANDARDS';

function tokenizeBM25(text) {
  const SPARSE_DIM = 30000;
  const FNV_OFFSET = 2166136261;
  const FNV_PRIME = 16777619;
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
    'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with'
  ]);
  function fnv1aMod(str) {
    let h = FNV_OFFSET;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, FNV_PRIME);
    }
    return ((h >>> 0) % SPARSE_DIM + SPARSE_DIM) % SPARSE_DIM;
  }
  const normalized = (text ?? '').toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  const tf = new Map();
  for (const t of tokens) {
    const idx = fnv1aMod(t);
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }
  const indices = [];
  const values = [];
  for (const [idx, count] of tf) {
    indices.push(idx);
    values.push(1 + Math.log(count));
  }
  return { indices, values };
}

async function getEmbedding(text) {
  const res = await fetch(`${OPENAI_API_URL}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: text })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI ${res.status}`);
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('OpenAI returned no embedding');
  return vec;
}

function buildFilter() {
  const must = [{ key: 'chain.step_index', match: { value: 1 } }];
  const searchSpaceIds = process.env.SEARCH_SPACE_IDS ? process.env.SEARCH_SPACE_IDS.split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (searchSpaceIds?.length) {
    must.unshift({ key: 'space_id', match: { any: searchSpaceIds } });
  }
  return {
    must,
    must_not: [{ has_id: [REFINING_PROTOCOL_UUID, CREATION_PROTOCOL_UUID] }]
  };
}

async function runQueryApi(body) {
  const url = `${QDRANT_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.status?.error || `Qdrant query ${res.status}`);
  const result = data?.result;
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.points)) return result.points;
  return [];
}

async function main() {
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    console.error('Missing QDRANT_URL or QDRANT_API_KEY. Set in .env');
    process.exit(1);
  }
  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY. Embedding required.');
    process.exit(1);
  }

  const normalizedQuery = query.trim().toLowerCase();
  console.log('Query:', query);
  console.log('Collection:', QDRANT_COLLECTION, `(limit ${limit})`);
  if (denseOnly) console.log('Mode: dense only (no BM25)');

  const vector = await getEmbedding(query);
  const vectorName = `vs${vector.length}`;
  const filter = buildFilter();

  const prefetches = [
    {
      query: vector,
      using: vectorName,
      limit: 40,
      filter,
      params: { quantization: { rescore: true } }
    }
  ];

  if (!denseOnly) {
    const sparse = tokenizeBM25(query);
    const bm25Leg = {
      query: { indices: sparse.indices, values: sparse.values },
      using: 'bm25',
      filter
    };
    prefetches.push({ ...bm25Leg, limit: 40 }, { ...bm25Leg, limit: 30 }, { ...bm25Leg, limit: 20 });
  }

  const body = {
    prefetch: {
      prefetch: prefetches,
      query: { fusion: 'rrf' },
      limit: 50
    },
    query: {
      formula: {
        sum: [
          '$score',
          {
            mult: [TITLE_BOOST, { key: 'chain.label', match: { text: normalizedQuery } }]
          },
          'attest_boost'
        ]
      },
      defaults: { attest_boost: 0 }
    },
    with_payload: true,
    limit
  };

  const points = await runQueryApi(body);
  console.log('\nScore    chain.label (truncated)                    attest_boost');
  console.log('─'.repeat(80));
  if (points.length === 0) {
    console.log('(no results)');
    return;
  }
  for (const p of points) {
    const score = typeof p.score === 'number' ? p.score.toFixed(4) : '—';
    const payload = p.payload || {};
    const chainLabel = payload.chain?.label ?? payload.chain_label ?? '—';
    const attestBoost = payload.attest_boost != null ? Number(payload.attest_boost).toFixed(4) : '—';
    console.log(`  ${String(score).padEnd(8)}  ${String(chainLabel).slice(0, 44).padEnd(44)}  ${attestBoost}`);
  }
  console.log('─'.repeat(80));
  if (points.length > 0) console.log(`Total: ${points.length} point(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
