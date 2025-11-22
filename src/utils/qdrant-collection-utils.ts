import { QdrantClient } from '@qdrant/js-client-rest';
import { getVectorDescriptors, VectorDescriptorMap } from './qdrant-vector-types.js';

/**
 * Create a Qdrant collection with standard vector configuration
 */
export async function createQdrantCollection(client: QdrantClient, collectionName: string, vectors?: VectorDescriptorMap): Promise<void> {
  // If caller provided explicit vector descriptors, use them, otherwise generate defaults
  const vecs = vectors || getVectorDescriptors();
  // Normalize to Qdrant expected shape: either single vector or named vectors
  let vectorConfig: any;
  const keys = Object.keys(vecs);
  if (keys.length === 1 && keys[0] === 'oai') {
    // Backwards compatibility: single vector under root
    const oaiVec = vecs['oai'];
    if (oaiVec) {
      vectorConfig = { size: oaiVec.size, distance: oaiVec.distance || 'Cosine', on_disk: oaiVec.on_disk };
    }
  } else {
    // Named vectors
    vectorConfig = {} as any;
    Object.entries(vecs).forEach(([k, v]) => {
      vectorConfig[k] = { size: v.size, distance: v.distance || 'Cosine', on_disk: v.on_disk };
    });
  }

  await client.createCollection(collectionName, {
    vectors: vectorConfig,
    quantization_config: {
      scalar: {
        type: "int8",
        always_ram: true,
      },
    },
  });
}

/**
 * Get the current vector size of an existing collection
 */
export async function getCollectionVectorConfig(client: QdrantClient, collectionName: string): Promise<VectorDescriptorMap | number | null> {
  try {
    const collectionInfo = await client.getCollection(collectionName);
    const vectors = collectionInfo.config?.params?.vectors;
    if (!vectors) return null;
    // If named vectors exist, parse named map
    if (typeof vectors === 'object' && !('size' in vectors)) {
      const out: VectorDescriptorMap = {};
      Object.entries(vectors).forEach(([k, v]: [string, any]) => {
        out[k] = { size: v.size, distance: v.distance || 'Cosine', on_disk: v.on_disk };
      });
      return out;
    }
    if (typeof vectors === 'object' && 'size' in vectors) {
      // Single vector configured (legacy)
      return (vectors as any).size;
    }
    return null;
  } catch {
    return null;
  }
}