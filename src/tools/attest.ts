import type { QdrantService } from '../services/qdrant/service.js';
import { redisCacheService } from '../services/redis-cache.js';
import { IDGenerator } from '../services/id-generator.js';
import { modelStats } from '../services/stats/model-stats.js';
import { logger } from '../utils/structured-logger.js';
import type { AttestInput, AttestOutput } from './attest_schema.js';

/** Shared execute: rate protocol step completion. Used by MCP tool and HTTP route. */
export async function executeAttest(
  qdrantService: QdrantService,
  input: AttestInput
): Promise<AttestOutput> {
  const { uri, outcome, quality_bonus = 0, message, llm_model_id } = input;
  const modelIdentity = {
    modelId: llm_model_id || 'reward',
    provider: 'unknown',
    family: 'unknown'
  };
  const uris = [uri];
  const results: AttestOutput['results'] = [];
  let totalRated = 0;
  let totalFailed = 0;

  logger.tool('rate', 'rate', `single rating of ${uri} with outcome="${outcome}" model="${modelIdentity.modelId}"`);

  for (const currentUri of uris) {
    try {
      const qdrantUuid = IDGenerator.qdrantIdFromUri(currentUri);
      const basicQualityBonus = outcome === 'success' ? 1 : -0.2;
      const currentPoint = await qdrantService.retrieveById(qdrantUuid);
      const currentMetrics = currentPoint?.payload?.quality_metrics || {};
      const implementationBonus = await modelStats.calculateImplementationBonus(
        currentMetrics,
        modelIdentity.modelId,
        outcome
      );
      const totalQualityBonus = basicQualityBonus + implementationBonus + quality_bonus;
      const metricsUpdate: Record<string, unknown> = {
        retrievalCount: 1,
        successCount: outcome === 'success' ? 1 : 0,
        failureCount: outcome === 'failure' ? 1 : 0,
        lastRated: new Date().toISOString(),
        lastRater: modelIdentity.modelId,
        qualityBonus: totalQualityBonus
      };
      if (message) {
        metricsUpdate['usageContext'] = message;
      }
      await qdrantService.updateQualityMetrics(qdrantUuid, metricsUpdate);
      await qdrantService.propagateAttestToChainHead(qdrantUuid, metricsUpdate);
      await redisCacheService.invalidateBeginCache();

      if (currentPoint?.payload) {
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
        logger.info(`reward: Updated quality metadata for ${currentUri} with execution ${outcome} - score: ${updatedQualityMetadata.step_quality_score} (${updatedQualityMetadata.step_quality})`);
      }

      await modelStats.processQualityFeedback(modelIdentity.modelId, currentUri, outcome, totalQualityBonus);
      if (implementationBonus > 0) {
        await modelStats.updateImplementationBonus(modelIdentity.modelId, implementationBonus);
      }

      results.push({
        uri: currentUri,
        outcome,
        quality_bonus: totalQualityBonus,
        message,
        rated_at: new Date().toISOString()
      });
      totalRated++;
      logger.success('rate', `rated ${currentUri} with ${outcome} (${totalQualityBonus} bonus)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        uri: currentUri,
        outcome,
        quality_bonus: 0,
        message: `Failed to rate ${currentUri}: ${errorMessage}`,
        rated_at: new Date().toISOString()
      });
      totalFailed++;
      logger.error(`rate failed for ${currentUri}`, error);
    }
  }

  return { results, total_rated: totalRated, total_failed: totalFailed };
}
