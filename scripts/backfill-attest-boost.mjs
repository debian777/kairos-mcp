#!/usr/bin/env node
/**
 * One-time backfill: set attest_boost on all chain heads (step_index === 1) from current quality_metrics.
 * Run after moving attest scoring into Qdrant formula so existing points participate.
 *
 * Usage (from repo root, .env with QDRANT_*):
 *   node -r dotenv/config scripts/backfill-attest-boost.mjs
 *   npm run backfill:attest-boost
 */
import 'dotenv/config';

const QDRANT_URL = (process.env.QDRANT_URL || '').replace(/\/$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'kairos';
const MIN_ATTEST_RUNS = parseInt(process.env.MIN_ATTEST_RUNS || '3', 10);
const RUNS_FULL_CONFIDENCE = parseInt(process.env.RUNS_FULL_CONFIDENCE || '10', 10);
const ATTEST_BOOST_MAX = parseFloat(process.env.ATTEST_BOOST_MAX || '0.08');

function computeAttestBoost(successCount, failureCount) {
  const runs = successCount + failureCount;
  if (runs < MIN_ATTEST_RUNS) return 0;
  const successRatio = runs > 0 ? successCount / runs : 0;
  const confidence = Math.min(runs / RUNS_FULL_CONFIDENCE, 1);
  return Math.min(ATTEST_BOOST_MAX * successRatio * confidence, ATTEST_BOOST_MAX);
}

async function scrollChainHeads(offset = null) {
  const url = `${QDRANT_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/scroll`;
  const body = {
    filter: {
      must: [{ key: 'chain.step_index', match: { value: 1 } }]
    },
    with_payload: true,
    with_vector: true,
    limit: 64,
    ...(offset != null && { offset })
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.status?.error || `Qdrant scroll ${res.status}`);
  return { points: data?.result?.points ?? [], next: data?.result?.next_page_offset };
}

async function upsertPoints(points) {
  if (points.length === 0) return;
  const url = `${QDRANT_URL}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points`;
  const payload = { points: points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload })) };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.status?.error || `Qdrant upsert ${res.status}`);
}

async function main() {
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    console.error('Missing QDRANT_URL or QDRANT_API_KEY. Set in .env');
    process.exit(1);
  }
  console.log('Backfilling attest_boost for chain heads in', QDRANT_COLLECTION);
  let offset = null;
  let total = 0;
  do {
    const { points, next } = await scrollChainHeads(offset);
    if (points.length === 0) break;
    const toUpsert = points.map((p) => {
      const qm = p.payload?.quality_metrics ?? {};
      const successCount = typeof qm.successCount === 'number' ? qm.successCount : 0;
      const failureCount = typeof qm.failureCount === 'number' ? qm.failureCount : 0;
      const attest_boost = computeAttestBoost(successCount, failureCount);
      return { ...p, payload: { ...p.payload, attest_boost } };
    });
    await upsertPoints(toUpsert);
    total += toUpsert.length;
    console.log('  upserted', toUpsert.length, 'points (total', total, ')');
    offset = next;
  } while (offset != null);
  console.log('Done. Backfilled attest_boost on', total, 'chain heads.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
