/**
 * Lightweight BM25-style tokenizer for sparse vectors.
 * Converts text to { indices, values } for Qdrant sparse vector search.
 * Tokenization: lowercase, split on non-alphanumeric, remove stop words.
 * Index: FNV-1a hash mod 30000. Value: sublinear TF 1 + log(tf).
 * No IDF client-side; Qdrant handles scoring.
 */

const SPARSE_DIM = 30000;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
  'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with'
]);

function fnv1aMod(str: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return ((h >>> 0) % SPARSE_DIM + SPARSE_DIM) % SPARSE_DIM;
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

/**
 * Tokenize text into a sparse vector for BM25 search.
 * Lowercase, split on non-alphanumeric, drop stop words and short tokens.
 * Indices from FNV-1a mod 30000; values from 1 + log(tf).
 */
export function tokenizeToSparse(text: string): SparseVector {
  const normalized = (text ?? '').toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  const tf = new Map<number, number>();
  for (const t of tokens) {
    const idx = fnv1aMod(t);
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }
  const indices: number[] = [];
  const values: number[] = [];
  for (const [idx, count] of tf) {
    indices.push(idx);
    values.push(1 + Math.log(count));
  }
  return { indices, values };
}

export const bm25Tokenizer = {
  tokenize: tokenizeToSparse
};
