#!/usr/bin/env tsx
/**
 * Migration script: Transform flat chain fields to nested chain object structure
 * 
 * Reads all Qdrant points with flat chain fields (memory_chain_id, chain_step_index, etc.)
 * and transforms them to use the new nested structure: chain: {id, label, step_index, step_count}
 * 
 * Usage:
 *   npm run migrate:chain
 *   or
 *   tsx scripts/migrate-chain-to-nested.ts [--dry-run] [--batch-size=100]
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { structuredLogger as logger } from '../src/utils/structured-logger.js';

const COLLECTION = process.env.QDRANT_COLLECTION || 'knowledge_base';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const DRY_RUN = process.argv.includes('--dry-run');

async function migrateChainStructure() {
    logger.info(`Starting chain structure migration for collection: ${COLLECTION}`);
    logger.info(`Qdrant URL: ${QDRANT_URL}`);
    logger.info(`Batch size: ${BATCH_SIZE}`);
    logger.info(`Dry run: ${DRY_RUN}`);

    const client = new QdrantClient({ url: QDRANT_URL });

    // Verify collection exists
    try {
        await client.getCollection(COLLECTION);
        logger.info(`Collection ${COLLECTION} found`);
    } catch (error) {
        logger.error(`Collection ${COLLECTION} not found: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }

    let totalProcessed = 0;
    let totalMigrated = 0;
    let totalSkipped = 0;
    let offset = undefined;

    do {
        // Fetch batch of points
        const scrollResult = await client.scroll(COLLECTION, {
            with_payload: true,
            with_vector: false,
            limit: BATCH_SIZE,
            offset
        });

        const points = scrollResult.points || [];
        logger.info(`Fetched batch: ${points.length} points`);

        // Transform points
        const updates = [];

        for (const point of points) {
            totalProcessed++;
            const payload = point.payload || {};

            // Check if point has flat chain fields
            const hasFlatChain = typeof payload.memory_chain_id === 'string';
            const hasNestedChain = payload.chain && typeof payload.chain.id === 'string';

            if (hasNestedChain) {
                // Already migrated
                totalSkipped++;
                continue;
            }

            if (!hasFlatChain) {
                // No chain data (singleton memory)
                totalSkipped++;
                continue;
            }

            // Build nested chain object from flat fields
            const chain = {
                id: payload.memory_chain_id,
                label: typeof payload.chain_label === 'string' ? payload.chain_label : 'Knowledge Chain',
                step_index: typeof payload.chain_step_index === 'number' ? payload.chain_step_index : 1,
                step_count: typeof payload.chain_step_count === 'number' ? payload.chain_step_count : 1
            };

            // Create new payload with nested chain and without flat fields
            const newPayload = { ...payload };
            delete newPayload.memory_chain_id;
            delete newPayload.chain_label;
            delete newPayload.chain_step_index;
            delete newPayload.chain_step_count;
            newPayload.chain = chain;

            updates.push({ id: point.id, payload: newPayload });
            totalMigrated++;

            if (totalMigrated % 10 === 0) {
                logger.info(`Prepared ${totalMigrated} updates so far...`);
            }
        }

        // Apply updates if not dry run
        if (updates.length > 0 && !DRY_RUN) {
            logger.info(`Updating ${updates.length} points in batch...`);

            // Use setPayload for each point (Qdrant doesn't support batch setPayload)
            for (const update of updates) {
                await client.setPayload(COLLECTION, {
                    points: [update.id],
                    payload: update.payload
                });
            }

            logger.info(`Updated ${updates.length} points`);
        } else if (updates.length > 0) {
            logger.info(`[DRY RUN] Would update ${updates.length} points`);
        }

        offset = scrollResult.next_page_offset;
    } while (offset);

    // Summary
    logger.info('═══════════════════════════════════════════');
    logger.info('Migration Summary:');
    logger.info(`  Total points processed: ${totalProcessed}`);
    logger.info(`  Points migrated: ${totalMigrated}`);
    logger.info(`  Points skipped: ${totalSkipped}`);
    logger.info(`  Dry run: ${DRY_RUN}`);
    logger.info('═══════════════════════════════════════════');

    if (DRY_RUN) {
        logger.info('This was a dry run. No changes were made.');
        logger.info('Run without --dry-run to apply changes.');
    } else {
        logger.info('Migration completed successfully!');
    }
}

// Run migration
migrateChainStructure()
    .then(() => {
        logger.info('Script finished');
        process.exit(0);
    })
    .catch((error) => {
        logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
        logger.error(error instanceof Error && error.stack ? error.stack : '');
        process.exit(1);
    });
