import { QDRANT_COLLECTION_CURRENT, getQdrantCollection } from '../config.js';
import { getEmbeddingDimension } from '../services/embedding/config.js';

/** Vector size from resolved embedding dimension (set at startup probe). */
export type VectorDescriptor = { size: number; distance?: 'Cosine' | 'Euclid' | 'Dot'; on_disk?: boolean };
export type VectorDescriptorMap = Record<string, VectorDescriptor>;

export function getVectorSize(): number {
  return getEmbeddingDimension();
}

export function getPrimaryVectorName(size: number = getEmbeddingDimension()): string {
  return `vs${size}`;
}

export function getAdapterTitleVectorName(size: number = getEmbeddingDimension()): string {
  return `adapter_title_vs${size}`;
}

export function getActivationPatternVectorName(size: number = getEmbeddingDimension()): string {
  return `activation_pattern_vs${size}`;
}

/**
 * Build a named vector configuration object from resolved dimension.
 * Uses "vs{DIMENSION}" naming to support migration between dimensions.
 */
export function getVectorDescriptors(): VectorDescriptorMap {
  const dim = getEmbeddingDimension();
  return {
    [getPrimaryVectorName(dim)]: { size: dim, distance: 'Cosine', on_disk: true },
    [getAdapterTitleVectorName(dim)]: { size: dim, distance: 'Cosine', on_disk: true },
    [getActivationPatternVectorName(dim)]: { size: dim, distance: 'Cosine', on_disk: true }
  };
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
    // Priority: explicit current mapping, then older QDRANT_COLLECTION, then alias itself
    return QDRANT_COLLECTION_CURRENT || getQdrantCollection();
  }
  return collectionName;
}