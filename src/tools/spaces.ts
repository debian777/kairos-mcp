/**
 * List the agent's available spaces with human-readable names,
 * adapter counts per space, and optionally adapter titles and layer counts.
 */

import type { MemoryQdrantStore } from '../services/memory/store.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { buildSpaceFilter } from '../utils/space-filter.js';
import { spaceIdToDisplayName, spaceKindFromSpaceId } from '../utils/space-display.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import { KAIROS_SPACES_TOOL_UI_META } from '../mcp-apps/kairos-ui-constants.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { spacesInputSchema, spacesOutputSchema } from './spaces_schema.js';
import { mcpLooseToolInput } from './mcp-loose-input-schema.js';
import { mcpToolInputValidationErrorResult } from './mcp-tool-input-teaching.js';
import { renderSpacesWidgetHtml } from '../mcp-apps/spaces-widget-html.js';

const DEFAULT_TOOL_NAME = 'spaces';
const SCROLL_LIMIT = 2000;

interface AdapterInfo {
  adapter_id: string;
  title: string;
  layer_count: number;
}

export interface SpaceInfo {
  name: string;
  space_id: string;
  type: 'personal' | 'group' | 'app' | 'other';
  adapter_count: number;
  adapters?: AdapterInfo[];
}

function dedupeSpaceIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getSpacesToReport(): string[] {
  const ctx = getSpaceContextFromStorage();
  const allowed = ctx.allowedSpaceIds;
  return dedupeSpaceIds([...allowed, KAIROS_APP_SPACE_ID]);
}

async function scrollSpace(
  client: { scroll: (collectionName: string, opts?: unknown) => Promise<{ points?: unknown[] }> } | unknown,
  collection: string,
  spaceId: string
): Promise<Array<{ id: string; payload?: Record<string, unknown> }>> {
  const filter = buildSpaceFilter([spaceId]);
  const scrollClient = client as { scroll: (collectionName: string, opts: unknown) => Promise<{ points?: unknown[] }> };
  const result = await scrollClient.scroll(collection, {
    filter,
    limit: SCROLL_LIMIT,
    with_payload: true,
    with_vector: false
  });
  const points = result?.points ?? [];
  return points as Array<{ id: string; payload?: Record<string, unknown> }>;
}

function buildSpaceInfo(
  spaceId: string,
  points: Array<{ id: string; payload?: Record<string, unknown> }>,
  includeAdapterTitles: boolean
): SpaceInfo {
  const name = spaceIdToDisplayName(spaceId);
  const byAdapter = new Map<string, Array<{ id: string; payload?: Record<string, unknown> }>>();

  for (const point of points) {
    const payload = point.payload ?? {};
    const adapterObject = payload['adapter'] as { id?: string } | undefined;
    const adapterId = adapterObject?.id ?? point.id;
    const key = typeof adapterId === 'string' ? adapterId : String(adapterId);
    if (!byAdapter.has(key)) byAdapter.set(key, []);
    byAdapter.get(key)!.push(point);
  }

  const adapterCount = byAdapter.size;
  const adapters: AdapterInfo[] = [];

  if (includeAdapterTitles) {
    for (const [, adapterPoints] of byAdapter) {
      const first = adapterPoints[0];
      const payload = first?.payload ?? {};
      const adapter = payload['adapter'] as
        | { id?: string; name?: string; layer_count?: number }
        | undefined;
      const title = (adapter?.name ?? payload['label'] ?? 'Untitled') as string;
      const adapterId = adapter?.id ?? first?.id ?? '';
      adapters.push({
        adapter_id: String(adapterId),
        title: String(title),
        layer_count:
          typeof adapter?.layer_count === 'number'
            ? adapter.layer_count
            : adapterPoints.length
      });
    }
  }

  const kind = spaceKindFromSpaceId(spaceId);
  const type: SpaceInfo['type'] = kind === 'other' ? 'other' : kind;
  return {
    name,
    space_id: spaceId,
    type,
    adapter_count: adapterCount,
    ...(includeAdapterTitles ? { adapters } : {})
  };
}

/**
 * List spaces and adapter counts. Uses current request space context (set by auth middleware).
 * Call from HTTP handlers or MCP tool.
 */
export async function executeSpaces(
  memoryStore: MemoryQdrantStore,
  options: { include_adapter_titles?: boolean } = {}
): Promise<{ spaces: SpaceInfo[] }> {
  const includeAdapterTitles = options.include_adapter_titles ?? false;
  const spaceIds = getSpacesToReport();
  const { client, collection } = memoryStore.getQdrantAccess();
  const spaces: SpaceInfo[] = [];

  for (const spaceId of spaceIds) {
    const points = await scrollSpace(client, collection, spaceId);
    spaces.push(buildSpaceInfo(spaceId, points, includeAdapterTitles));
  }

  return { spaces };
}

export interface RegisterSpacesOptions {
  toolName?: string;
}

export function registerSpacesTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterSpacesOptions = {}): void {
  const toolName = options.toolName ?? DEFAULT_TOOL_NAME;

  server.registerTool(
    toolName,
    {
      title: 'List spaces and adapter counts',
      description: getToolDoc('spaces') ?? 'List the agent\'s available spaces with human-readable names and adapter counts. Optionally include adapter titles and layer counts per space.',
      inputSchema: mcpLooseToolInput(spacesInputSchema),
      outputSchema: spacesOutputSchema,
      _meta: KAIROS_SPACES_TOOL_UI_META
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params ?? {}).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      const parsedInput = spacesInputSchema.safeParse(params ?? {});
      if (!parsedInput.success) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return mcpToolInputValidationErrorResult('spaces', parsedInput.error, params);
      }
      const paramsOk = parsedInput.data;

      try {
        const wantWidget = paramsOk.include_widget_html ?? false;
        const includeTitles = wantWidget || (paramsOk.include_adapter_titles ?? false);
        const output = await executeSpaces(memoryStore, { include_adapter_titles: includeTitles });
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        const jsonText = JSON.stringify(output);
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, jsonText.length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        const content: Array<{ type: 'text'; text: string }> = [{ type: 'text' as const, text: jsonText }];
        if (wantWidget) {
          content.push({ type: 'text' as const, text: renderSpacesWidgetHtml(output.spaces) });
        }
        return {
          content,
          structuredContent: output
        };
      } catch (error) {
        structuredLogger.warn(`[${toolName}] error: ${error instanceof Error ? error.message : String(error)}`);
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : String(error) }) }],
          isError: true
        };
      }
    }
  );
}
