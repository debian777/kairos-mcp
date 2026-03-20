import type { QdrantService } from '../services/qdrant/service.js';
import { IDGenerator } from '../services/id-generator.js';
import { modelStats } from '../services/stats/model-stats.js';
import { logger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { attestInputSchema, attestOutputSchema, type AttestInput, type AttestOutput } from './kairos_attest_schema.js';

/** Shared execute: rate protocol step completion. Used by MCP tool and HTTP route. */
export async function executeAttest(
  qdrantService: QdrantService,
  input: AttestInput
): Promise<AttestOutput> {
  const { uri, outcome, quality_bonus = 0, message, llm_model_id } = input;
  const modelIdentity = {
    modelId: llm_model_id || 'kairos-attest',
    provider: 'unknown',
    family: 'unknown'
  };
  const uris = [uri];
  const results: AttestOutput['results'] = [];
  let totalRated = 0;
  let totalFailed = 0;

  logger.tool('rate', 'rate', `single rating of ${uri} with outcome="${outcome}" model="${modelIdentity.modelId}"`);

  for (const u of uris) {
    try {
      const qdrantUuid = IDGenerator.qdrantIdFromUri(u);
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
        logger.info(`attest: Updated quality metadata for ${u} with execution ${outcome} - score: ${updatedQualityMetadata.step_quality_score} (${updatedQualityMetadata.step_quality})`);
      }

      await modelStats.processQualityFeedback(modelIdentity.modelId, u, outcome, totalQualityBonus);
      if (implementationBonus > 0) {
        await modelStats.updateImplementationBonus(modelIdentity.modelId, implementationBonus);
      }

      results.push({
        uri: u,
        outcome,
        quality_bonus: totalQualityBonus,
        message,
        rated_at: new Date().toISOString()
      });
      totalRated++;
      logger.success('rate', `rated ${u} with ${outcome} (${totalQualityBonus} bonus)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        uri: u,
        outcome,
        quality_bonus: 0,
        message: `Failed to rate ${u}: ${errorMessage}`,
        rated_at: new Date().toISOString()
      });
      totalFailed++;
      logger.error(`rate failed for ${u}`, error);
    }
  }

  return { results, total_rated: totalRated, total_failed: totalFailed };
}

interface RegisterAttestOptions {
  toolName?: string;
}

export function registerKairosAttestTool(server: any, qdrantService: QdrantService, options: RegisterAttestOptions = {}) {
  const toolName = options.toolName || 'kairos_attest';
  logger.debug(`kairos_attest registration inputSchema: ${JSON.stringify(attestInputSchema)}`);
  logger.debug(`kairos_attest registration outputSchema: ${JSON.stringify(attestOutputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Finalize protocol execution',
      description: getToolDoc('kairos_attest') || 'Stamp of completion. Call after the last step is solved via kairos_next. No final_solution required.',
      inputSchema: attestInputSchema,
      outputSchema: attestOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      const spaceId = getSpaceContextFromStorage()?.defaultWriteSpaceId ?? 'default';
      logger.debug(`kairos_attest space_id=${spaceId}`);
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = attestInputSchema.parse(params);
        const result = await executeAttest(qdrantService, input);
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(result).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        logger.error('attest failed', error);
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: `Rate failed: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
}
