import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { parseKairosUri } from './kairos-uri.js';
import type { ExportOutput } from './export_schema.js';

const ALLOWED_ARTIFACT_MIMES = [
  'text/x-python',
  'text/x-shellscript',
  'text/javascript',
  'text/x-perl',
  'text/x-toml',
  'text/yaml',
  'text/plain'
] as const;

function parseArtifactUri(uri: string): string | null {
  const match = /^kairos:\/\/artifact\/([0-9a-f-]{36})$/i.exec((uri || '').trim());
  return match?.[1] ?? null;
}

async function sourceFromMemory(memoryStore: MemoryQdrantStore, uri: string, memoryId: string): Promise<ExportOutput> {
  const memory = await memoryStore.getMemory(memoryId);
  if (!memory) {
    throw new Error('Artifact not found');
  }
  return {
    uri,
    format: 'source',
    content_type: memory.content_type || 'text/markdown',
    content: memory.text,
    item_count: 1,
    adapter_name: memory.adapter?.name ?? null,
    adapter_version: memory.adapter?.protocol_version ?? null
  };
}

async function sourceListForAdapter(memoryStore: MemoryQdrantStore, uri: string, adapterId: string): Promise<ExportOutput> {
  const { client, collection } = memoryStore.getQdrantAccess();
  const artifacts: Array<{
    uri: string;
    artifact_uuid: string;
    label: string;
    content_type: string;
    tags: string[];
  }> = [];
  let offset: string | number | undefined;
  do {
    const page = await client.scroll(collection, {
      filter: {
        must: [
          { key: 'adapter.id', match: { value: adapterId } },
          { key: 'content_type', match: { any: [...ALLOWED_ARTIFACT_MIMES] } }
        ]
      },
      limit: 256,
      ...(offset !== undefined ? { offset } : {}),
      with_payload: true,
      with_vector: false
    });
    const points = Array.isArray(page?.points) ? page.points : [];
    for (const point of points) {
      const payload = (point?.payload ?? {}) as Record<string, unknown>;
      const idRaw = point?.id;
      const id = typeof idRaw === 'string' ? idRaw : typeof idRaw === 'number' ? String(idRaw) : '';
      if (!id) continue;
      artifacts.push({
        uri: `kairos://artifact/${id}`,
        artifact_uuid: id,
        label: typeof payload['label'] === 'string' ? payload['label'] : id,
        content_type: typeof payload['content_type'] === 'string' ? payload['content_type'] : 'text/plain',
        tags: Array.isArray(payload['tags']) ? payload['tags'].map((t) => String(t)) : []
      });
    }
    const nextOffset = page?.next_page_offset;
    offset = typeof nextOffset === 'string' || typeof nextOffset === 'number' ? nextOffset : undefined;
  } while (offset !== null && offset !== undefined);

  return {
    uri,
    format: 'source',
    content_type: 'application/json',
    content: JSON.stringify({ artifacts }),
    item_count: artifacts.length,
    adapter_name: null,
    adapter_version: null
  };
}

export async function executeExportSource(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  uri: string,
  resolveAdapter: (memoryStore: MemoryQdrantStore, qdrantService: QdrantService | undefined, uri: string) => Promise<{ adapterId: string; layerId: string }>
): Promise<ExportOutput> {
  const parsedArtifactId = parseArtifactUri(uri);
  if (parsedArtifactId) {
    return sourceFromMemory(memoryStore, uri, parsedArtifactId);
  }

  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'adapter') {
    return sourceListForAdapter(memoryStore, uri, parsed.id);
  }

  const { layerId } = await resolveAdapter(memoryStore, qdrantService, uri);
  return sourceFromMemory(memoryStore, uri, layerId);
}
