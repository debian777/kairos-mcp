#!/usr/bin/env node
/**
 * Test that OPENAI_API_KEY has access to /v1/embeddings only.
 * Use this to verify a restricted key (Embeddings = Request, rest = None) works locally.
 *
 * Usage (from repo root):
 *   npm run dev:test-embedding-key     # uses .env
 *   OPENAI_API_KEY=sk-... node scripts/test-embedding-key.mjs
 *
 * Loads .env from repo root when run via npm (dotenv/config).
 */
import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() || '';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';
const ENDPOINT = 'https://api.openai.com/v1/embeddings';

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY. Set it in .env or: OPENAI_API_KEY=sk-... node scripts/test-embedding-key.mjs');
  process.exit(1);
}

async function main() {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: 'test',
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok && Array.isArray(body?.data?.[0]?.embedding)) {
    console.log('OK: Embeddings access works.');
    console.log(`  Model: ${OPENAI_EMBEDDING_MODEL}, dimension: ${body.data[0].embedding.length}`);
    process.exit(0);
  }

  console.error(`FAIL: HTTP ${res.status}`);
  if (body.error?.message) console.error('  ', body.error.message);
  if (res.status === 403) {
    console.error('  Likely cause: key missing "Embeddings" Request permission or wrong model.');
  }
  process.exit(1);
}

main();
