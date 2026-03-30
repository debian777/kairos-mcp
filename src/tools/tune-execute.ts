import type { QdrantService } from '../services/qdrant/service.js';
import { getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { resolveSpaceParamForContext } from '../utils/resolve-space-param.js';
import { CodeBlockProcessor } from '../services/code-block-processor.js';
import { IDGenerator } from '../services/id-generator.js';
import { buildHeaderMemoryAdapter } from '../services/memory/adapter-builder.js';
import { parseFrontmatter } from '../utils/frontmatter.js';
import { executeUpdate } from './update.js';
import { type TuneInput, type TuneOutput } from './tune_schema.js';
import { parseKairosUri, buildLayerUri } from './kairos-uri.js';
import { buildTuneResultMessage } from './tune-messages.js';

type AdapterLayerPoint = { uuid: string; payload: any };

function sortByLayerIndex(layers: AdapterLayerPoint[]): AdapterLayerPoint[] {
  return [...layers].sort((left, right) => {
    const li =
      typeof left.payload?.adapter?.layer_index === 'number'
        ? left.payload.adapter.layer_index
        : Number.MAX_SAFE_INTEGER;
    const ri =
      typeof right.payload?.adapter?.layer_index === 'number'
        ? right.payload.adapter.layer_index
        : Number.MAX_SAFE_INTEGER;
    return li - ri;
  });
}

function selectAdapterLayerSet(layers: AdapterLayerPoint[], preferredSpaceId?: string): AdapterLayerPoint[] {
  if (layers.length <= 1) {
    return sortByLayerIndex(layers);
  }

  const groupedBySpace = new Map<string, AdapterLayerPoint[]>();
  for (const layer of layers) {
    const sid = typeof layer.payload?.space_id === 'string' ? layer.payload.space_id.trim() : '';
    const key = sid.length > 0 ? sid : '__unknown__';
    groupedBySpace.set(key, [...(groupedBySpace.get(key) ?? []), layer]);
  }

  if (groupedBySpace.size <= 1) {
    return sortByLayerIndex(layers);
  }

  const ctx = getSpaceContextFromStorage();
  const candidateSpaceIds = [preferredSpaceId, ctx.defaultWriteSpaceId].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  for (const candidate of candidateSpaceIds) {
    const selected = groupedBySpace.get(candidate.trim());
    if (selected && selected.length > 0) {
      return sortByLayerIndex(selected);
    }
  }

  const fallbackSpaceId = [...groupedBySpace.keys()].sort((a, b) => a.localeCompare(b))[0];
  return sortByLayerIndex(groupedBySpace.get(fallbackSpaceId!) ?? layers);
}

async function normalizeTuneUri(qdrantService: QdrantService, uri: string, preferredSpaceId?: string): Promise<string> {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'layer') {
    return `kairos://mem/${parsed.id}`;
  }

  const layers = selectAdapterLayerSet(await qdrantService.getAdapterLayers(parsed.id), preferredSpaceId);
  const head = layers[0]?.uuid ?? parsed.id;
  return `kairos://mem/${head}`;
}

async function collectLayerMemoryUuidsForTune(
  qdrantService: QdrantService,
  uri: string,
  preferredSpaceId?: string
): Promise<string[]> {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'layer') {
    return [parsed.id];
  }
  const layers = selectAdapterLayerSet(await qdrantService.getAdapterLayers(parsed.id), preferredSpaceId);
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

async function tuneAdapterMarkdownInPlace(
  qdrantService: QdrantService,
  adapterUri: string,
  markdownDoc: string
): Promise<string> {
  const parsed = parseKairosUri(adapterUri);
  if (parsed.kind !== 'adapter') {
    throw new Error('tuneAdapterMarkdownInPlace requires an adapter URI');
  }

  const existingLayers = selectAdapterLayerSet(await qdrantService.getAdapterLayers(parsed.id));
  if (existingLayers.length === 0) {
    throw new Error(`Adapter not found: ${adapterUri}`);
  }

  const currentModel = existingLayers[0]?.payload?.llm_model_id;
  const llmModelId =
    typeof currentModel === 'string' && currentModel.trim().length > 0 ? currentModel.trim() : 'tune-in-place';

  const parsedDoc = parseFrontmatter(markdownDoc);
  const adapterMarkdown = parsedDoc.body.length > 0 ? parsedDoc.body : markdownDoc;
  const codeBlockProcessor = new CodeBlockProcessor();
  const nextLayers = buildHeaderMemoryAdapter(adapterMarkdown, llmModelId, new Date(), codeBlockProcessor);
  if (nextLayers.length === 0) {
    throw new Error('Invalid adapter markdown: expected H1 with at least one layer');
  }

  const nextAdapterName = nextLayers[0]?.adapter?.name?.trim() ?? '';
  if (!nextAdapterName) {
    throw new Error('Invalid adapter markdown: missing adapter title (H1)');
  }
  const expectedAdapterId = IDGenerator.generateAdapterUUIDv5(nextAdapterName);
  if (expectedAdapterId !== parsed.id) {
    throw new Error(
      `Adapter title "${nextAdapterName}" resolves to ${expectedAdapterId}, but tune target is ${parsed.id}. Keep the H1 unchanged when tuning by adapter URI.`
    );
  }

  if (nextLayers.length !== existingLayers.length) {
    throw new Error(
      `Layer count mismatch: adapter has ${existingLayers.length} layers, markdown has ${nextLayers.length}. Use train(force_update=true) for structural adapter changes.`
    );
  }

  const frontmatterVersion =
    typeof parsedDoc.version === 'string' && parsedDoc.version.trim().length > 0 ? parsedDoc.version.trim() : undefined;
  if (frontmatterVersion) {
    for (const memory of nextLayers) {
      if (memory.adapter) {
        memory.adapter.protocol_version = frontmatterVersion;
      }
    }
  }

  for (let i = 0; i < existingLayers.length; i++) {
    const existing = existingLayers[i]!;
    const next = nextLayers[i]!;
    const existingAdapter =
      existing.payload?.adapter && typeof existing.payload.adapter === 'object'
        ? (existing.payload.adapter as Record<string, unknown>)
        : {};
    const nextAdapter = next.adapter;

    const adapterUpdate: Record<string, unknown> = {
      ...existingAdapter,
      id: parsed.id,
      name: nextAdapter?.name ?? existingAdapter['name'],
      layer_index: i + 1,
      layer_count: nextLayers.length,
      activation_patterns: Array.isArray(nextAdapter?.activation_patterns) ? nextAdapter.activation_patterns : [],
      reward_signal: typeof nextAdapter?.reward_signal === 'string' ? nextAdapter.reward_signal : ''
    };
    if (typeof nextAdapter?.protocol_version === 'string' && nextAdapter.protocol_version.trim().length > 0) {
      adapterUpdate['protocol_version'] = nextAdapter.protocol_version.trim();
    }

    await qdrantService.updateMemory(existing.uuid, {
      label: next.label,
      text: next.text,
      tags: next.tags,
      adapter: adapterUpdate,
      inference_contract: next.inference_contract ?? null
    });
  }

  return buildLayerUri(existingLayers[0]!.uuid);
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

  const results: TuneOutput['results'] = [];
  let total_updated = 0;
  let total_failed = 0;

  for (let i = 0; i < input.uris.length; i++) {
    const originalUri = input.uris[i]!;
    const markdownAtIndex = Array.isArray(input.markdown_doc) ? input.markdown_doc[i] : undefined;
    const parsedUri = parseKairosUri(originalUri);
    try {
      if (parsedUri.kind === 'adapter' && typeof markdownAtIndex === 'string' && markdownAtIndex.trim().length > 0) {
        const layerUri = await tuneAdapterMarkdownInPlace(qdrantService, originalUri, markdownAtIndex);
        results.push({
          uri: layerUri,
          status: 'updated',
          message: `Adapter layer ${layerUri} updated successfully`
        });
        total_updated++;
        continue;
      }

      const normalizedUri = await normalizeTuneUri(qdrantService, originalUri);
      const perUriUpdate = await executeUpdate(qdrantService, {
        uris: [normalizedUri] as any,
        markdown_doc: typeof markdownAtIndex === 'string' ? [markdownAtIndex] : undefined,
        updates: input.updates
      });
      const entry = perUriUpdate.results[0];
      const layerUri = buildLayerUri((entry?.uri ?? normalizedUri).split('/').pop() ?? '');
      const row = {
        uri: layerUri,
        status: entry?.status ?? 'error',
        message: buildTuneResultMessage(
          entry ?? { status: 'error', message: 'Failed to update memory: Unknown update failure' },
          layerUri
        )
      } as TuneOutput['results'][number];
      results.push(row);
      if (row.status === 'updated') total_updated++;
      else total_failed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        uri: originalUri,
        status: 'error',
        message: `Failed to update adapter layer: ${errorMessage}`
      });
      total_failed++;
    }
  }

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
