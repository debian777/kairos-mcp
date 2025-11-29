import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';

/**
 * Set up API route for kairos_update
 * @param app Express application instance
 * @param qdrantService Qdrant service instance
 */
export function setupUpdateRoute(app: express.Express, qdrantService: QdrantService) {
    app.post('/api/kairos_update', async (req, res) => {
        const startTime = Date.now();

        try {
            const { uris, markdown_doc, updates } = req.body;

            if (!uris || !Array.isArray(uris) || uris.length === 0) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'uris is required and must be a non-empty array'
                });
                return;
            }

            if (markdown_doc && (!Array.isArray(markdown_doc) || markdown_doc.length !== uris.length)) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'markdown_doc array length must match uris array length'
                });
                return;
            }

            structuredLogger.info(`→ POST /api/kairos_update (${uris.length} URI(s))`);

            const extractBody = (text: string): string => {
                const start = /<!--\s*KAIROS:BODY-START\s*-->/i;
                const end = /<!--\s*KAIROS:BODY-END\s*-->/i;
                const s = text.search(start);
                const e = text.search(end);
                if (s >= 0 && e > s) {
                    const startMatch = text.match(start);
                    if (!startMatch) return text;
                    const startIdx = (startMatch.index || 0) + startMatch[0].length;
                    return text.slice(startIdx, e).trim();
                }
                return text;
            };

            const results: any[] = [];
            let totalUpdated = 0;
            let totalFailed = 0;

            for (let i = 0; i < uris.length; i++) {
                const uri = uris[i];
                try {
                    const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
                    if (!uuid) {
                        throw new Error('Invalid URI format');
                    }

                    const mk = Array.isArray(markdown_doc) ? markdown_doc[i] : undefined;
                    if (typeof mk === 'string' && mk.trim().length > 0) {
                        const body = extractBody(mk);
                        await qdrantService.updateMemory(uuid, { text: body });
                    } else if (updates && Object.keys(updates).length > 0) {
                        if (typeof updates['text'] === 'string' && updates['text'].indexOf('<!-- KAIROS:BODY-START') !== -1 && updates['text'].indexOf('<!-- KAIROS:BODY-END') !== -1) {
                            const body = extractBody(updates['text']);
                            await qdrantService.updateMemory(uuid, { text: body });
                        } else {
                            await qdrantService.updateMemory(uuid, updates);
                        }
                    } else {
                        throw new Error('Provide markdown_doc or updates');
                    }

                    results.push({
                        uri,
                        status: 'updated',
                        message: `Memory ${uri} updated successfully`
                    });
                    totalUpdated++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({
                        uri,
                        status: 'error',
                        message: `Failed to update memory: ${errorMessage}`
                    });
                    totalFailed++;
                }
            }

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ kairos_update completed in ${duration}ms (${totalUpdated} updated, ${totalFailed} failed)`);

            res.status(200).json({
                results,
                total_updated: totalUpdated,
                total_failed: totalFailed,
                metadata: { duration_ms: duration }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`✗ kairos_update failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'UPDATE_FAILED',
                message: error instanceof Error ? error.message : 'Failed to update memories',
                duration_ms: duration
            });
        }
    });
}


