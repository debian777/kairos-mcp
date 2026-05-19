import { jest } from '@jest/globals';
import crypto from 'node:crypto';

describe('Mem resources boot injection dedupe regression', () => {
  test('boot injection recovers when app-space already contains duplicate adapter.id/slug entries', async () => {
    const originalCollection = process.env.QDRANT_COLLECTION;
    const testCollection = `kairos-test-mem-boot-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    let keyValueStoreForThisTest: { disconnect(): Promise<void> } | undefined;
    let collectionToDelete: string | undefined;
    let qdrantClient: any;

    try {
      jest.resetModules();
      process.env.QDRANT_COLLECTION = testCollection;

      const [
        { probeEmbeddingDimension },
        { installQdrantFetchCompatibility },
        { MemoryQdrantStore },
        { injectMemResourcesAtBoot },
        { KAIROS_APP_SPACE_ID },
        { keyValueStore }
      ] = await Promise.all([
          import('../../src/services/embedding/service.js'),
          import('../../src/services/qdrant/undici-compat.js'),
          import('../../src/services/memory/store.js'),
          import('../../src/resources/mem-resources-boot.js'),
          import('../../src/config.js'),
          import('../../src/services/key-value-store-factory.js')
        ]);

      installQdrantFetchCompatibility();
      keyValueStoreForThisTest = keyValueStore;
      await probeEmbeddingDimension();
      const memoryStore = new MemoryQdrantStore();
      await memoryStore.init();

      const { client, collection } = memoryStore.getQdrantAccess();
      qdrantClient = client;
      collectionToDelete = collection;

      await injectMemResourcesAtBoot(memoryStore, { force: true });

      const targetUuid = '00000000-0000-0000-0000-000000002001';
      const base = await client.retrieve(collection, {
        ids: [targetUuid],
        with_payload: true,
        with_vector: true
      } as any);

      expect(Array.isArray(base)).toBe(true);
      expect(base[0]).toBeDefined();
      const basePoint = base[0] as any;

      const conflictId = crypto.randomUUID();
      await client.delete(collection, { points: [targetUuid] } as any);
      await client.upsert(collection, {
        points: [
          {
            id: conflictId,
            payload: basePoint.payload,
            vector: basePoint.vector
          }
        ]
      } as any);

      await injectMemResourcesAtBoot(memoryStore, { force: true });

      const restored = await client.retrieve(collection, {
        ids: [targetUuid],
        with_payload: true,
        with_vector: false
      } as any);

      expect(Array.isArray(restored)).toBe(true);
      expect(restored[0]).toBeDefined();
      expect((restored[0] as any)?.payload?.space_id).toBe(KAIROS_APP_SPACE_ID);

      await client.delete(collection, { points: [conflictId] } as any);
    } finally {
      if (qdrantClient && collectionToDelete) {
        try {
          await qdrantClient.deleteCollection(collectionToDelete);
        } catch {
        }
      }
      if (keyValueStoreForThisTest) {
        await keyValueStoreForThisTest.disconnect();
      }
      if (originalCollection === undefined) {
        delete process.env.QDRANT_COLLECTION;
      } else {
        process.env.QDRANT_COLLECTION = originalCollection;
      }
    }
  }, 120000);
});
