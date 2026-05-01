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

interface ArtifactUriResolution {
  requestedUri: string;
  artifactUuid: string;
  uri: string;
}

async function resolveArtifactUri(qdrantService: QdrantService | undefined, uri: string): Promise<ArtifactUriResolution | null> {
  const parsed = parseKairosUri((uri || '').trim());
  if (parsed.kind !== 'artifact') return null;
  if (parsed.idKind === 'uuid') {
    return { requestedUri: uri, artifactUuid: parsed.id, uri };
  }
  if (!qdrantService) {
    throw new Error('Artifact slug lookup is unavailable');
  }
  const resolved = await qdrantService.findArtifactMemoryUuidBySlug(parsed.id);
  if (resolved.disambiguation_note) {
    throw new Error(resolved.disambiguation_note);
  }
  if (!resolved.artifactUuid) {
    throw new Error(`Artifact slug "${parsed.id}" not found`);
  }
  return {
    requestedUri: uri,
    artifactUuid: resolved.artifactUuid,
    uri
  };
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
    uuid_uri: string;
    artifact_uuid: string;
    label: string;
    slug: string;
    version: string;
    sha256: string;
    name: string;
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
      const artifactPayload = (payload['artifact'] ?? {}) as Record<string, unknown>;
      const slug = typeof artifactPayload['slug'] === 'string' && artifactPayload['slug'].trim().length > 0
        ? artifactPayload['slug']
        : id;
      const version = typeof artifactPayload['version'] === 'string' && artifactPayload['version'].trim().length > 0
        ? artifactPayload['version']
        : '1';
      const sha256 = typeof artifactPayload['sha256'] === 'string' ? artifactPayload['sha256'] : '';
      const name = typeof artifactPayload['name'] === 'string' && artifactPayload['name'].trim().length > 0
        ? artifactPayload['name']
        : (typeof payload['label'] === 'string' ? payload['label'] : id);
      artifacts.push({
        uri: `kairos://artifact/${slug}`,
        uuid_uri: `kairos://artifact/${id}`,
        artifact_uuid: id,
        label: typeof payload['label'] === 'string' ? payload['label'] : id,
        slug,
        version,
        sha256,
        name,
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
  const parsedArtifact = await resolveArtifactUri(qdrantService, uri);
  if (parsedArtifact) {
    return sourceFromMemory(memoryStore, parsedArtifact.uri, parsedArtifact.artifactUuid);
  }

  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'adapter') {
    const { adapterId } = await resolveAdapter(memoryStore, qdrantService, uri);
    return sourceListForAdapter(memoryStore, uri, adapterId);
  }

  const { layerId } = await resolveAdapter(memoryStore, qdrantService, uri);
  return sourceFromMemory(memoryStore, uri, layerId);
}
