import { z } from 'zod';
import { QdrantService } from '../services/qdrant/service.js';
import { IDGenerator } from '../services/id-generator.js';
import { knowledgeGame } from '../services/game/knowledge-game.js';
import { logger } from '../utils/logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';

interface RegisterAttestOptions {
  toolName?: string;
}

export function registerKairosAttestTool(server: any, qdrantService: QdrantService, options: RegisterAttestOptions = {}) {
  const toolName = options.toolName || 'kairos_attest';

  const inputSchema = z.object({
    uri: z.string().min(1).describe('URI of the completed memory step'),
    completion_status: z.enum(['completed', 'failed']).describe('Status of the step execution'),
    context: z.string().optional().describe('Optional usage context'),
    llm_model_id: z.string().describe('Use your REAL LLM model ID')
  });

  const outputSchema = z.object({
    results: z.array(z.object({
      uri: z.string(),
      outcome: z.string(),
      quality_bonus: z.number(),
      message: z.string(),
      rated_at: z.string()
    })),
    total_rated: z.number(),
    total_failed: z.number()
  });

  logger.debug(`kairos_attest registration inputSchema: ${JSON.stringify(inputSchema)}`);
  logger.debug(`kairos_attest registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Attest step completion',
      description: getToolDoc('kairos_attest'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const { uri, completion_status, context: usageContext, llm_model_id } = params;

      // Use provided model identity
      const modelIdentity = {
        modelId: llm_model_id,
        provider: 'unknown', // Will be determined from model ID if needed
        family: 'unknown'   // Will be determined from model ID if needed
      };

      // Validate input: require URI
      if (!uri) {
        throw new Error('uri must be a string');
      }
      const uris = [uri];
      const outcome = completion_status === 'completed' ? 'success' : 'failure';
      const uriArray: string[] = uris;

      logger.tool('rate', 'rate', `single rating of ${uri} with outcome="${outcome}" model="${modelIdentity.modelId}"`);

      try {
        const results: any[] = [];
        let totalRated = 0;
        let totalFailed = 0;

        // Process each URI (apply same outcome to all)
        for (const uri of uriArray) {
          try {
            // Convert URI to Qdrant UUID for internal use
            const qdrantUuid = IDGenerator.qdrantIdFromUri(uri);

            // Calculate basic quality bonus based on outcome
            const basicQualityBonus = outcome === 'success' ? 1 : -0.2;

            // Retrieve current quality metrics to calculate implementation bonus
            const currentPoint = await qdrantService.retrieveById(qdrantUuid);
            const currentMetrics = currentPoint?.payload?.quality_metrics || {};

            // Calculate implementation success bonus
            const implementationBonus = await knowledgeGame.calculateImplementationBonus(
              currentMetrics,
              modelIdentity.modelId,
              outcome
            );

            // Total bonus combines basic quality + implementation success
            const totalQualityBonus = basicQualityBonus + implementationBonus;

            // Update quality metrics in Qdrant
            const metricsUpdate: any = {
              retrievalCount: 1,
              successCount: outcome === 'success' ? 1 : 0,
              failureCount: outcome === 'failure' ? 1 : 0,
              lastRated: new Date().toISOString(),
              lastRater: modelIdentity.modelId,
              qualityBonus: totalQualityBonus
            };

            if (usageContext) {
              metricsUpdate.usageContext = usageContext;
            }

            await qdrantService.updateQualityMetrics(qdrantUuid, metricsUpdate);

            // Recalculate gem metadata with execution success context!
            // Successful executions dramatically boost gem potential
            if (currentPoint?.payload) {
              const { description_short, domain, task, type, tags } = currentPoint.payload;

              // Calculate new gem metadata with execution success
              const updatedGemMetadata = knowledgeGame.calculateStepGemMetadata(
                description_short || 'Knowledge step',
                domain || 'general',
                task || 'general',
                type || 'context',
                tags || [],
                outcome // Pass execution success to boost gem potential!
              );

              // Update gem metadata in Qdrant
              await qdrantService.updateGemMetadata(qdrantUuid, {
                step_gem_potential: updatedGemMetadata.step_gem_potential,
                step_quality: updatedGemMetadata.step_quality,
                motivational_text: updatedGemMetadata.motivational_text
              });

              logger.info(`attest: Updated gem metadata for ${uri} with execution ${outcome} - potential: ${updatedGemMetadata.step_gem_potential} (${updatedGemMetadata.step_quality})`);
            }

            // Process quality feedback for the game
            await knowledgeGame.processQualityFeedback(
              modelIdentity.modelId,
              uri,
              outcome,
              totalQualityBonus
            );

            // Update implementation bonuses in leaderboard
            if (implementationBonus > 0) {
              await knowledgeGame.updateImplementationBonus(modelIdentity.modelId, implementationBonus);
            }

            results.push({
              uri: uri,
              outcome: outcome,
              quality_bonus: totalQualityBonus,
              message: `Quality feedback recorded for ${modelIdentity.modelId}`,
              rated_at: new Date().toISOString()
            });
            totalRated++;

            logger.success('rate', `rated ${uri} with ${outcome} (${totalQualityBonus} bonus)`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.push({
              uri: uri,
              outcome: outcome,
              error: errorMessage,
              message: `Failed to rate ${uri}: ${errorMessage}`
            });
            totalFailed++;

            logger.error(`rate failed for ${uri}`, error);
          }
        }

        // Always return bulk response with results and totals
        const result = {
          results,
          total_rated: totalRated,
          total_failed: totalFailed
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }],
          structuredContent: result
        };
      } catch (error) {
        logger.error('attest failed', error);

        return {
          content: [{
            type: 'text',
            text: `Rate failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          contents: [{
            type: 'text',
            text: `Rate failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
}