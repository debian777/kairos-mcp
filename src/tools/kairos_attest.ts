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
  const memoryUriSchema = z
    .string()
    .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

  const inputSchema = z.object({
    uri: memoryUriSchema.describe('URI of the last step in the protocol'),
    outcome: z.enum(['success', 'failure']).describe('Execution outcome'),
    message: z.string().min(1).describe('Short summary of how the protocol went'),
    quality_bonus: z.number().optional().default(0).describe('Additional quality bonus to apply'),
    llm_model_id: z.string().optional().describe('Optional model identifier for attribution')
  });

  const outputSchema = z.object({
    results: z.array(z.object({
      uri: memoryUriSchema,
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
      title: 'Finalize protocol execution',
      description: getToolDoc('kairos_attest') || 'Stamp of completion. Call after the last step is solved via kairos_next. No final_solution required.',
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

      const modelIdentity = {
        modelId: llm_model_id || 'kairos-attest',
        provider: 'unknown',
        family: 'unknown'
      };

      if (!uri) {
        throw new Error('uri must be a string');
      }
      const uris = [uri];
      const uriArray: string[] = uris;

      logger.tool('rate', 'rate', `single rating of ${uri} with outcome="${outcome}" model="${modelIdentity.modelId}"`);

        const results: any[] = [];
        let totalRated = 0;
        let totalFailed = 0;

        for (const uri of uriArray) {
          try {
            const qdrantUuid = IDGenerator.qdrantIdFromUri(uri);
            const basicQualityBonus = outcome === 'success' ? 1 : -0.2;

            const currentPoint = await qdrantService.retrieveById(qdrantUuid);
            const currentMetrics = currentPoint?.payload?.quality_metrics || {};

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

              logger.info(`attest: Updated quality metadata for ${uri} with execution ${outcome} - score: ${updatedQualityMetadata.step_quality_score} (${updatedQualityMetadata.step_quality})`);
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
