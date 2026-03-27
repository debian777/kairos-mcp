import type { QdrantService } from '../services/qdrant/service.js';
import { qdrantService as qdrantServiceSingleton } from '../services/qdrant/index.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { getTenantId, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { resolveSpaceParamForContext } from '../utils/resolve-space-param.js';
import { executeUpdate } from './update.js';
import { tuneInputSchema, tuneOutputSchema, type TuneInput, type TuneOutput } from './tune_schema.js';
import { parseKairosUri, buildLayerUri } from './kairos-uri.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { buildTuneResultMessage } from './tune-messages.js';

async function normalizeTuneUri(qdrantService: QdrantService, uri: string): Promise<string> {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'layer') {
    return `kairos://mem/${parsed.id}`;
  }

  const layers = await qdrantService.getAdapterLayers(parsed.id);
  const head = layers[0]?.uuid ?? parsed.id;
  return `kairos://mem/${head}`;
}

async function collectLayerMemoryUuidsForTune(qdrantService: QdrantService, uri: string): Promise<string[]> {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'layer') {
    return [parsed.id];
  }
  const layers = await qdrantService.getAdapterLayers(parsed.id);
  return layers.map((l) => l.uuid);
}

async function reassignAdapterLayersToSpace(
  qdrantService: QdrantService,
  originalUri: string,
  targetSpaceId: string
): Promise<void> {
  const layerUuids = await collectLayerMemoryUuidsForTune(qdrantService, originalUri);
  for (const uuid of layerUuids) {
    await qdrantService.updateMemory(uuid, { space_id: targetSpaceId });
  }
}

export async function executeTune(qdrantService: QdrantService, input: TuneInput): Promise<TuneOutput> {
  const ctx = getSpaceContextFromStorage();
  const rawSpace = typeof input.space === 'string' ? input.space.trim() : '';
  let targetSpaceId: string | undefined;
  if (rawSpace.length > 0) {
    const r = resolveSpaceParamForContext(ctx, rawSpace);
    if (!r.ok) {
      throw new Error(r.message);
    }
    targetSpaceId = r.spaceId;
    if (!ctx.allowedSpaceIds.includes(targetSpaceId)) {
      throw new Error('Target space is not in your allowed spaces');
    }
  }

  const hasMarkdown =
    Array.isArray(input.markdown_doc) &&
    input.markdown_doc.some((s) => typeof s === 'string' && s.trim().length > 0);
  const hasUpdates = input.updates && Object.keys(input.updates).length > 0;
  const hasContent = Boolean(hasMarkdown || hasUpdates);

  if (!hasContent && !targetSpaceId) {
    throw new Error('Provide markdown_doc, updates, or space');
  }

  const normalizedUris = await Promise.all(input.uris.map((uri) => normalizeTuneUri(qdrantService, uri)));

  if (!hasContent && targetSpaceId) {
    const results: TuneOutput['results'] = [];
    let total_updated = 0;
    let total_failed = 0;
    for (const originalUri of input.uris) {
      try {
        const layerUuids = await collectLayerMemoryUuidsForTune(qdrantService, originalUri);
        for (const uuid of layerUuids) {
          await qdrantService.updateMemory(uuid, { space_id: targetSpaceId });
        }
        const head = layerUuids[0];
        results.push({
          uri: head ? buildLayerUri(head) : originalUri,
          status: 'updated',
          message: 'Adapter layers reassigned to target space'
        });
        total_updated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          uri: originalUri,
          status: 'error',
          message: `Space move failed: ${errorMessage}`
        });
        total_failed++;
      }
    }
    return { results, total_updated, total_failed };
  }

  const updateResult = await executeUpdate(qdrantService, {
    uris: normalizedUris as any,
    markdown_doc: input.markdown_doc,
    updates: input.updates
  });

  const results = updateResult.results.map((entry) => {
    const layerUri = buildLayerUri(entry.uri.split('/').pop() ?? '');
    return {
      uri: layerUri,
      status: entry.status,
      message: buildTuneResultMessage(entry, layerUri)
    };
  });

  let total_updated = updateResult.total_updated;
  let total_failed = updateResult.total_failed;

  if (targetSpaceId) {
    for (let i = 0; i < input.uris.length; i++) {
      const originalUri = input.uris[i]!;
      const row = results[i];
      if (!row || row.status !== 'updated') continue;
      try {
        await reassignAdapterLayersToSpace(qdrantService, originalUri, targetSpaceId);
        row.message = `${row.message} Reassigned to target space.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results[i] = {
          uri: row.uri,
          status: 'error',
          message: `Content updated but space reassignment failed: ${errorMessage}`
        };
        total_failed++;
        total_updated--;
      }
    }
  }

  return {
    results,
    total_updated,
    total_failed
  };
}

export function registerTuneTool(server: any, toolName = 'tune') {
  const qdrantService = qdrantServiceSingleton;
  server.registerTool(
    toolName,
    {
      title: 'Update adapter content',
      description: getToolDoc('tune') || 'Update adapter layer content.',
      inputSchema: tuneInputSchema,
      outputSchema: tuneOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = tuneInputSchema.parse(params);
        const result = await executeTune(qdrantService, input);
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(result).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result
        };
      } catch (error) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        throw error;
      }
    }
  );
}
