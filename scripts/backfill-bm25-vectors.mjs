#!/usr/bin/env node
/**
 * Backfill BM25 sparse vectors for existing points in the collection.
 * Scrolls all points, generates sparse vector from label+text, batch upserts with bm25 alongside existing dense vector.
 * Run after collection has sparse_vectors.bm25 config. Usage (from repo root, .env with QDRANT_*):
 *   node -r dotenv/config scripts/backfill-bm25-vectors.mjs
 *   ENV=dev ./scripts/run-env.sh may set QDRANT_URL; use QDRANT_COLLECTION for target (e.g. kairos_dev).
 */
import 'dotenv/config';

const QDRANT_URL = (process.env.QDRANT_URL || 'http://127.0.0.1:6333').replace(/\/$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'kairos_dev';
const BATCH_SIZE = 50;

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

function tokenizeToSparse(text) {
  const normalized = (text ?? '').toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
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

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (QDRANT_API_KEY) h['api-key'] = QDRANT_API_KEY;
  return h;
}

async function scroll(offset = null, limit = 100) {
  const body = { limit, with_payload: true, with_vector: true };
  if (offset != null) body.offset = offset;
  const res = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/scroll`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.status?.error || `Qdrant scroll ${res.status}`);
  return data?.result ?? { points: [], next_page_offset: null };
}

async function upsert(points) {
  const res = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points?wait=true`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ points }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.status?.error || `Qdrant upsert ${res.status}`);
}

function getDenseVector(point) {
  const v = point.vector;
  if (!v || typeof v !== 'object') return null;
  if (Array.isArray(v)) return v;
  const keys = Object.keys(v).filter(k => k !== 'bm25' && k.startsWith('vs'));
  if (keys.length === 0) return null;
  const name = keys[0];
  const vec = v[name];
  return Array.isArray(vec) ? { name, vector: vec } : null;
}

async function main() {
  console.log(`Backfilling BM25 for collection ${QDRANT_COLLECTION} at ${QDRANT_URL}`);
  let total = 0;
  let offset = null;
  do {
    const { points, next_page_offset } = await scroll(offset, BATCH_SIZE);
    if (points.length === 0) break;
    const toUpsert = [];
    for (const p of points) {
      const label = p.payload?.label ?? '';
      const text = p.payload?.text ?? '';
      const sparse = tokenizeToSparse(`${label} ${text}`);
      const dense = getDenseVector(p);
      if (!dense) {
        console.warn(`Skip point ${p.id}: no dense vector`);
        continue;
      }
      toUpsert.push({
        id: p.id,
        vector: {
          [dense.name]: dense.vector,
          bm25: { indices: sparse.indices, values: sparse.values },
        },
        payload: p.payload,
      });
    }
    if (toUpsert.length > 0) {
      await upsert(toUpsert);
      total += toUpsert.length;
      console.log(`Upserted ${toUpsert.length} points (total ${total})`);
    }
    offset = next_page_offset ?? null;
  } while (offset !== null);
  console.log(`Backfill done. Total points updated: ${total}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
