import { z } from 'zod';
import { QdrantService } from '../services/qdrant/service.js';
import { IDGenerator } from '../services/id-generator.js';
import { modelStats } from '../services/stats/model-stats.js';
import { logger } from '../utils/logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

interface RegisterAttestOptions {
  toolName?: string;
}

export function registerKairosAttestTool(server: any, qdrantService: QdrantService, options: RegisterAttestOptions = {}) {
  const toolName = options.toolName || 'kairos_attest';

  const inputSchema = z.object({
    uri: z.string().min(1).describe('URI of the completed memory step'),
    outcome: z.enum(['success', 'failure']).describe('Execution outcome'),
    quality_bonus: z.number().optional().default(0).describe('Additional quality bonus to apply'),
    message: z.string().min(1).describe('Attestation summary message'),
    llm_model_id: z.string().optional().describe('Optional model identifier for attribution')
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
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      
      const timer = mcpToolDuration.startTimer({ 
        tool: toolName,
        tenant_id: tenantId 
      });
      
      let result: any;
      
      try {
        const { uri, outcome, quality_bonus = 0, message, llm_model_id } = params;

      // Use provided model identity
      const modelIdentity = {
        modelId: llm_model_id || 'kairos-attest',
        provider: 'unknown', // Will be determined from model ID if needed
        family: 'unknown'   // Will be determined from model ID if needed
      };

      // Validate input: require URI
      if (!uri) {
        throw new Error('uri must be a string');
      }
      const uris = [uri];
      const uriArray: string[] = uris;

      logger.tool('rate', 'rate', `single rating of ${uri} with outcome="${outcome}" model="${modelIdentity.modelId}"`);

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
            const implementationBonus = await modelStats.calculateImplementationBonus(
              currentMetrics,
              modelIdentity.modelId,
              outcome
            );

            // Total bonus combines basic quality + implementation success
            const totalQualityBonus = basicQualityBonus + implementationBonus + quality_bonus;

            // Update quality metrics in Qdrant
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

            // Recalculate quality metadata with execution success context!
            // Successful executions dramatically boost quality score
            if (currentPoint?.payload) {
              const { description_short, domain, task, type, tags } = currentPoint.payload;

              // Calculate new quality metadata with execution success
              const updatedQualityMetadata = modelStats.calculateStepQualityMetadata(
                description_short || 'Knowledge step',
                domain || 'general',
                task || 'general',
                type || 'context',
                tags || [],
                outcome // Pass execution success to boost quality score!
              );

              // Update quality metadata in Qdrant
              await qdrantService.updateQualityMetadata(qdrantUuid, {
                step_quality_score: updatedQualityMetadata.step_quality_score,
                step_quality: updatedQualityMetadata.step_quality
              });

              logger.info(`attest: Updated quality metadata for ${uri} with execution ${outcome} - score: ${updatedQualityMetadata.step_quality_score} (${updatedQualityMetadata.step_quality})`);
            }

            // Process quality feedback
            await modelStats.processQualityFeedback(
              modelIdentity.modelId,
              uri,
              outcome,
              totalQualityBonus
            );

            // Update implementation bonuses
            if (implementationBonus > 0) {
              await modelStats.updateImplementationBonus(modelIdentity.modelId, implementationBonus);
            }

            results.push({
              uri: uri,
              outcome: outcome,
              quality_bonus: totalQualityBonus,
              message,
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
        result = {
          results,
          total_rated: totalRated,
          total_failed: totalFailed
        };

        const finalResult = {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }],
          structuredContent: result
        };
        
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        const outputSize = JSON.stringify(finalResult).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        return finalResult;
      } catch (error) {
        logger.error('attest failed', error);
        
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        mcpToolErrors.inc({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        timer({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });

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