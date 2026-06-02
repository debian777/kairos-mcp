import type { QdrantService } from '../services/qdrant/service.js';

type AdapterLayerPoint = { uuid: string; payload: any };

/**
 * Post-write verification: re-read each updated layer from Qdrant and confirm
 * its text matches the expected value. Catches the silent no-op scenario where
 * updateMemory reports success but the underlying store did not persist the
 * change (stale-cache guard).
 */
export async function verifyTuneLayerPersistence(
  qdrantService: QdrantService,
  layers: AdapterLayerPoint[],
  expected: Array<{ text: string }>
): Promise<void> {
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]!;
    const refreshed = await qdrantService.getMemoryByUUID(layer.uuid);
    if (!refreshed) throw new Error(`Post-write verification failed: layer ${layer.uuid} not found after update`);
    if (typeof refreshed.text !== 'string' || refreshed.text !== expected[i]!.text) {
      throw new Error(`Post-write verification failed: layer ${layer.uuid} text mismatch — stale cache or write failure`);
    }
  }
}
