import { getEmbeddingDimension, QDRANT_COLLECTION_CURRENT, getQdrantCollection } from '../config.js';

/**
 * Get the vector size from environment variable EMBEDDING_DIMENSION
 */
export type VectorDescriptor = { size: number; distance?: 'Cosine' | 'Euclid' | 'Dot'; on_disk?: boolean };
export type VectorDescriptorMap = Record<string, VectorDescriptor>;

/**
 * Get the vector size for the default provider (OpenAI) from environment variable EMBEDDING_DIMENSION
 * Backwards compatible helper for single-vector deployments.
 */
export function getVectorSize(): number {
  return getEmbeddingDimension();
}

/**
 * Build a named vector configuration object from environment variables.
 * Uses "vs{DIMENSION}" naming to support migration between dimensions.
 * Only one vector space active at a time, but supports migration from old to new.
 */
export function getVectorDescriptors(): VectorDescriptorMap {
  const dim = getEmbeddingDimension(1536);
  const map: VectorDescriptorMap = {};
  map[`vs${dim}`] = { size: dim, distance: 'Cosine', on_disk: true };
  return map;
}

/**
 * Resolve a potential 'current' alias for Qdrant collection names.
 *
 * Usage:
 * - If callers pass the literal alias 'current' (or an env var resolves to it),
 *   this function returns the real collection name derived from:
 *     1) process.env['QDRANT_COLLECTION_CURRENT']
 *     2) process.env['QDRANT_COLLECTION'] (fallback)
 *     3) the provided collection string (final fallback)
 *
 * This allows code to use the stable alias 'current' while the actual
 * target collection can be changed via environment without touching code.
 */
export function resolveCollectionAlias(collectionName: string): string {
  if (!collectionName) return collectionName;
  if (collectionName === 'current') {
    // Priority: explicit current mapping, then legacy QDRANT_COLLECTION, then alias itself
    return QDRANT_COLLECTION_CURRENT || getQdrantCollection();
  }
  return collectionName;
}