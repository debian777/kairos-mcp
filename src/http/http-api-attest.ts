import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { IDGenerator } from '../services/id-generator.js';
import { modelStats } from '../services/stats/model-stats.js';

/**
 * Set up API route for kairos_attest
 * @param app Express application instance
 * @param qdrantService Qdrant service instance
 */
export function setupAttestRoute(app: express.Express, qdrantService: QdrantService) {
    app.post('/api/kairos_attest', async (req, res) => {
        const startTime = Date.now();

        try {
            const { uri, outcome, quality_bonus = 0, message, llm_model_id } = req.body;

            if (!uri || typeof uri !== 'string') {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'uri is required and must be a string'
                });
                return;
            }

            if (!outcome || !['success', 'failure'].includes(outcome)) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'outcome is required and must be "success" or "failure"'
                });
                return;
            }

            if (!message || typeof message !== 'string') {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'message is required and must be a string'
                });
                return;
            }

            structuredLogger.info(`→ POST /api/kairos_attest (uri: ${uri}, outcome: ${outcome})`);

            const modelIdentity = {
                modelId: llm_model_id || 'http-api-attest',
                provider: 'unknown',
                family: 'unknown'
            };

            const qdrantUuid = IDGenerator.qdrantIdFromUri(uri);
            const basicQualityBonus = outcome === 'success' ? 1 : -0.2;

            const currentPoint = await qdrantService.retrieveById(qdrantUuid);
            if (!currentPoint) {
                res.status(404).json({
                    error: 'NOT_FOUND',
                    message: `Memory not found: ${uri}`
                });
                return;
            }

            const currentMetrics = currentPoint.payload?.quality_metrics || {};
            const implementationBonus = await modelStats.calculateImplementationBonus(
                currentMetrics,
                modelIdentity.modelId,
                outcome
            );

            const totalQualityBonus = basicQualityBonus + implementationBonus + quality_bonus;

            const metricsUpdate: any = {
                retrievalCount: 1,
                successCount: outcome === 'success' ? 1 : 0,
                failureCount: outcome === 'failure' ? 1 : 0,
                lastRated: new Date().toISOString(),
                lastRater: modelIdentity.modelId,
                qualityBonus: totalQualityBonus
            };

            if (message) {
                metricsUpdate.usageContext = message;
            }

            await qdrantService.updateQualityMetrics(qdrantUuid, metricsUpdate);

            if (currentPoint.payload) {
                const { description_short, domain, task, type, tags } = currentPoint.payload;
                const updatedQualityMetadata = modelStats.calculateStepQualityMetadata(
                    description_short || 'Knowledge step',
                    domain || 'general',
                    task || 'general',
                    type || 'context',
                    tags || [],
                    outcome
                );

                await qdrantService.updateQualityMetadata(qdrantUuid, {
                    step_quality_score: updatedQualityMetadata.step_quality_score,
                    step_quality: updatedQualityMetadata.step_quality
                });
            }

            await modelStats.processQualityFeedback(
                modelIdentity.modelId,
                uri,
                outcome,
                totalQualityBonus
            );

            if (implementationBonus > 0) {
                await modelStats.updateImplementationBonus(modelIdentity.modelId, implementationBonus);
            }

            const result = {
                uri: uri,
                outcome: outcome,
                quality_bonus: totalQualityBonus,
                message,
                rated_at: new Date().toISOString()
            };

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ kairos_attest completed in ${duration}ms`);

            res.status(200).json({
                results: [result],
                total_rated: 1,
                total_failed: 0,
                metadata: { duration_ms: duration }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`✗ kairos_attest failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'ATTEST_FAILED',
                message: error instanceof Error ? error.message : 'Failed to attest step completion',
                duration_ms: duration
            });
        }
    });
}

