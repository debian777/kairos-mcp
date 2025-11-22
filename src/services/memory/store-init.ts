import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../../utils/logger.js';
import { getVectorDescriptors, createQdrantCollection, getCollectionVectorConfig, addVectorsToCollection, migrateVectorSpace, removeVectorFromCollection, countPointsWithVector, getVectorSize } from '../../utils/qdrant-utils.js';
import { embeddingService } from '../embedding/service.js';

export async function initializeQdrantStore(client: QdrantClient, collection: string, url: string): Promise<void> {
  try {
    logger.info(
      `[MemoryQdrantStore] Checking Qdrant collections at "${url}" for "${collection}"`
    );

    const collections = await client.getCollections();
    const names = (collections.collections || []).map((c: any) => c.name);
    logger.info(
      `[MemoryQdrantStore] Qdrant getCollections OK, existing collections=${JSON.stringify(
        names
      )}`
    );

    const exists = names.includes(collection);
    const vectorDescriptors = getVectorDescriptors();
    const currentDim = Object.values(vectorDescriptors)[0]?.size ?? getVectorSize();
    const currentVectorName = `vs${currentDim}`;

    if (!exists) {
      logger.info(
        `[MemoryQdrantStore] Creating collection "${collection}" at "${url}" with vector ${currentVectorName} (size ${currentDim})`
      );
      await createQdrantCollection(client, collection, vectorDescriptors);
      logger.info(
        `[MemoryQdrantStore] Collection "${collection}" created successfully`
      );
    } else {
      // Check existing collection vector config
      const collectionConfig = await getCollectionVectorConfig(client, collection);
      if (collectionConfig === null) {
        const errorMsg = `[MemoryQdrantStore] Collection ${collection} vector config could not be determined.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      let existingVectorName: string | null = null;
      let existingDim: number | null = null;

      if (typeof collectionConfig === 'number') {
        // Legacy single vector
        existingDim = collectionConfig;
        existingVectorName = `vs${existingDim}`;
        logger.info(`[MemoryQdrantStore] Detected legacy single vector collection with size ${existingDim}, will migrate to named vector ${existingVectorName}`);
      } else {
        // Named vectors
        const vectorNames = Object.keys(collectionConfig);
        if (vectorNames.length === 1) {
          existingVectorName = vectorNames[0]!;
          existingDim = (collectionConfig as any)[existingVectorName]?.size || null;
        } else if (vectorNames.length > 1) {
          logger.warn(`[MemoryQdrantStore] Collection has multiple vectors: ${vectorNames.join(', ')}. Migration may be complex.`);
          // For now, assume the first one is the active one
          existingVectorName = vectorNames[0]!;
          existingDim = (collectionConfig as any)[existingVectorName]?.size || null;
        }
      }

      if (existingDim === currentDim && existingVectorName === currentVectorName) {
        logger.info(
          `[MemoryQdrantStore] Collection "${collection}" already exists with correct vector ${currentVectorName} (size ${currentDim})`
        );
      } else {
        logger.info(`[MemoryQdrantStore] Dimension change detected: ${existingDim} -> ${currentDim}. Starting migration. existingVector=${existingVectorName} currentVector=${currentVectorName}`);

        // Step 1: If legacy, convert to named vector by adding the named version
        if (typeof collectionConfig === 'number') {
          // For legacy, we need to add the named vector first
          logger.info(`[MemoryQdrantStore] Step 1: Adding named vector ${existingVectorName} to legacy collection`);
          try {
            await addVectorsToCollection(client, collection, { [existingVectorName!]: { size: existingDim!, distance: 'Cosine', on_disk: true } });
            logger.info(`[MemoryQdrantStore] Step 1 complete: Added named vector ${existingVectorName} to legacy collection`);
          } catch (err) {
            logger.error(`[MemoryQdrantStore] Step 1 failed: could not add named vector ${existingVectorName} to ${collection}: ${String(err)}`);
            throw err;
          }
        }

        // Step 2: Add the new vector space
        logger.info(`[MemoryQdrantStore] Step 2: Adding new vector ${currentVectorName} (size ${currentDim})`);
        try {
          await addVectorsToCollection(client, collection, vectorDescriptors);
          logger.info(`[MemoryQdrantStore] Step 2 complete: Added new vector ${currentVectorName} (size ${currentDim})`);
        } catch (err) {
          logger.error(`[MemoryQdrantStore] Step 2 failed: could not add new vector ${currentVectorName} to ${collection}: ${String(err)}`);
          throw err;
        }

        // Step 3: Migrate data from old to new vector
        if (existingVectorName && existingVectorName !== currentVectorName) {
          logger.info(`[MemoryQdrantStore] Step 3: Migrating data from ${existingVectorName} to ${currentVectorName}`);
          try {
            // Pre-migration counts
            const oldCount = await countPointsWithVector(client, collection, existingVectorName);
            logger.info(`[MemoryQdrantStore] Pre-migration: points with ${existingVectorName}=${oldCount}`);
            await migrateVectorSpace(client, collection, existingVectorName, currentVectorName, embeddingService, 64);
            logger.info(`[MemoryQdrantStore] Step 3 complete: Migrated data from ${existingVectorName} to ${currentVectorName}`);
            // Post-migration counts
            const newCount = await countPointsWithVector(client, collection, currentVectorName);
            logger.info(`[MemoryQdrantStore] Post-migration: points with ${currentVectorName}=${newCount}`);
            // Simple check: if newCount >= oldCount, attempt to remove old vector
            if (newCount >= oldCount) {
              logger.info(`[MemoryQdrantStore] Precondition satisfied: ${newCount} >= ${oldCount}. Attempting to remove old vector ${existingVectorName}`);
              try {
                await removeVectorFromCollection(client, collection, existingVectorName);
              } catch (remErr) {
                logger.warn(`[MemoryQdrantStore] removeVectorFromCollection failed: ${String(remErr)}`);
              }
            } else {
              logger.warn(`[MemoryQdrantStore] Precondition failed: ${newCount} < ${oldCount}. Not removing old vector ${existingVectorName}`);
            }
          } catch (err) {
            logger.error(`[MemoryQdrantStore] Step 3 failed: Migration error from ${existingVectorName} to ${currentVectorName}: ${String(err)}`);
            // Attempt to continue: try to remove vector if partial migration isn't critical
            throw err;
          }

          // Step 4: Attempt to remove old vector (may not be supported)
          logger.info(`[MemoryQdrantStore] Step 4: Attempting to remove old vector ${existingVectorName} from collection ${collection}`);
          try {
            await removeVectorFromCollection(client, collection, existingVectorName);
            logger.info(`[MemoryQdrantStore] Step 4 complete: Removed old vector ${existingVectorName}`);
          } catch (err) {
            logger.warn(`[MemoryQdrantStore] Step 4 warning: ${String(err)}`);
          }
        }
        logger.info(`[MemoryQdrantStore] Migration complete for collection "${collection}" - status=SUCCESS`);
      }
    }
  } catch (error) {
    logger.error(
      `[MemoryQdrantStore] Failed to initialize Qdrant memory store at "${url}" (collection="${collection}")`,
      error
    );
    throw error;
  }
}