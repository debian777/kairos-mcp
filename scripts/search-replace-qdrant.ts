#!/usr/bin/env ts-node

/**
 * Script to search and replace text in Qdrant collection
 * Usage: ts-node scripts/search-replace-qdrant.ts <collection> <search> <replace>
 * Example: ts-node scripts/search-replace-qdrant.ts kairos_live "ai-helper proof-of-work" "ai-helper solve-challenge"
 */

import { QdrantConnection } from '../dist/services/qdrant/connection.js';
import { embeddingService } from '../dist/services/embedding/service.js';
import { sanitizeAndUpsert } from '../dist/services/qdrant/utils.js';
import { logger } from '../dist/utils/logger.js';

async function searchAndReplace(
  collectionName: string,
  searchText: string,
  replaceText: string
): Promise<void> {
  const qdrantUrl = process.env['QDRANT_URL'] || 'http://localhost:6333';
  const apiKey = process.env['QDRANT_API_KEY'] || '';
  const caCertPath = process.env['QDRANT_CA_CERT_PATH'];

  logger.info(`Connecting to Qdrant at ${qdrantUrl}, collection: ${collectionName}`);
  const conn = new QdrantConnection(qdrantUrl, apiKey, collectionName, caCertPath);

  let updatedCount = 0;
  let totalScanned = 0;
  let offset: string | undefined = undefined;
  const batchSize = 100;

  logger.info(`Searching for: "${searchText}"`);
  logger.info(`Replacing with: "${replaceText}"`);

  while (true) {
    const scrollResult = await conn.executeWithReconnect(async () => {
      return await conn.client.scroll(conn.collectionName, {
        limit: batchSize,
        offset: offset,
        with_payload: true,
        with_vector: true
      });
    });

    if (!scrollResult.points || scrollResult.points.length === 0) {
      break;
    }

    totalScanned += scrollResult.points.length;
    logger.info(`Scanned ${totalScanned} points so far...`);

    const pointsToUpdate: any[] = [];

    for (const point of scrollResult.points) {
      const payload = point.payload as any;
      let needsUpdate = false;
      const updatedPayload: any = { ...payload };

      // Check all text fields that might contain the search text
      const textFields = [
        'description_full',
        'description_short',
        'text',
        'label',
        'content'
      ];

      for (const field of textFields) {
        if (payload[field] && typeof payload[field] === 'string') {
          // Case-insensitive search
          const fieldValue = payload[field];
          const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          if (searchRegex.test(fieldValue)) {
            updatedPayload[field] = fieldValue.replace(searchRegex, replaceText);
            needsUpdate = true;
            logger.info(`Found match in ${field} for point ${point.id}`);
          }
        }
      }

      // Also check nested objects (like ai field) and all other string fields
      if (payload.ai && typeof payload.ai === 'object') {
        const aiStr = JSON.stringify(payload.ai);
        const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (searchRegex.test(aiStr)) {
          const updatedAiStr = aiStr.replace(searchRegex, replaceText);
          updatedPayload.ai = JSON.parse(updatedAiStr);
          needsUpdate = true;
          logger.info(`Found match in ai field for point ${point.id}`);
        }
      }

      // Check all other string fields in payload recursively
      function checkObject(obj: any, path: string = ''): boolean {
        if (typeof obj === 'string') {
          const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          if (searchRegex.test(obj)) {
            return true;
          }
        } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [key, value] of Object.entries(obj)) {
            if (checkObject(value, path ? `${path}.${key}` : key)) {
              return true;
            }
          }
        } else if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            if (checkObject(obj[i], `${path}[${i}]`)) {
              return true;
            }
          }
        }
        return false;
      }

      function replaceInObject(obj: any): any {
        if (typeof obj === 'string') {
          const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          return obj.replace(searchRegex, replaceText);
        } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = replaceInObject(value);
          }
          return result;
        } else if (Array.isArray(obj)) {
          return obj.map(item => replaceInObject(item));
        }
        return obj;
      }

      // Deep check all payload fields
      if (checkObject(payload)) {
        const updatedDeep = replaceInObject(payload);
        Object.assign(updatedPayload, updatedDeep);
        needsUpdate = true;
        logger.info(`Found match in nested fields for point ${point.id}`);
      }

      if (needsUpdate) {
        // Get existing vector
        let vector: number[] = [];
        let existingVectorObj: any = undefined;
        if (point.vector) {
          existingVectorObj = point.vector;
          if (Array.isArray(point.vector)) {
            vector = point.vector as number[];
          } else if (typeof point.vector === 'object') {
            const firstKey = Object.keys(point.vector || {})[0];
            if (firstKey && Array.isArray((point.vector as any)[firstKey])) {
              vector = (point.vector as any)[firstKey] as number[];
            }
          }
        }

        // Regenerate embedding if description_full or text changed
        const textChanged = 
          (updatedPayload.description_full && updatedPayload.description_full !== payload.description_full) ||
          (updatedPayload.text && updatedPayload.text !== payload.text);

        if (textChanged) {
          const source = updatedPayload.description_full || updatedPayload.text || '';
          try {
            const embeddingResult = await embeddingService.generateEmbedding(source);
            vector = embeddingResult.embedding;
            logger.info(`Regenerated embedding for point ${point.id}`);
          } catch (error) {
            logger.error(`Failed to generate embedding for point ${point.id}: ${error instanceof Error ? error.message : String(error)}`);
            // Continue with existing vector if embedding fails
          }
        }

        const upsertPoint: any = {
          id: point.id,
          payload: {
            ...updatedPayload,
            updated_at: new Date().toISOString()
          }
        };

        if (Array.isArray(vector) && vector.length > 0) {
          const currentVectorName = `vs${vector.length}`;
          upsertPoint.vector = { [currentVectorName]: vector };
        } else if (existingVectorObj) {
          upsertPoint.vector = existingVectorObj;
        }

        pointsToUpdate.push(upsertPoint);
      }
    }

    if (pointsToUpdate.length > 0) {
      await conn.executeWithReconnect(async () => {
        await sanitizeAndUpsert(conn.client, conn.collectionName, pointsToUpdate);
      });
      updatedCount += pointsToUpdate.length;
      logger.info(`Updated ${pointsToUpdate.length} points (total updated: ${updatedCount})`);
    }

    // Check if there are more points
    if (!scrollResult.next_page_offset) {
      break;
    }
    offset = scrollResult.next_page_offset;
  }

  logger.info(`\n=== Summary ===`);
  logger.info(`Total points scanned: ${totalScanned}`);
  logger.info(`Total points updated: ${updatedCount}`);
  logger.info(`Search text: "${searchText}"`);
  logger.info(`Replace text: "${replaceText}"`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: ts-node scripts/search-replace-qdrant.ts <collection> <search> <replace>');
  console.error('Example: ts-node scripts/search-replace-qdrant.ts kairos_live "ai-helper proof-of-work" "ai-helper solve-challenge"');
  process.exit(1);
}

const [collectionName, searchText, replaceText] = args;

searchAndReplace(collectionName, searchText, replaceText)
  .then(() => {
    logger.info('Search and replace completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Error during search and replace:', error);
    process.exit(1);
  });

