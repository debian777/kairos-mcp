import type { MemoryQdrantStore } from '../services/memory/store.js';
import { ALLOWED_ARTIFACT_MIMES } from './artifact-mime.js';
import { buildSpaceFilter } from '../utils/space-filter.js';
import { getSearchSpaceIds } from '../utils/tenant-context.js';

export interface AdapterArtifactMetadata {
  artifact_uuid: string;
  adapter_id: string;
  adapter_name: string | null;
  label: string;
  slug: string;
  version: string;
  name: string;
  relative_path: string | null;
  sha256: string;
  content_type: string;
  tags: string[];
  text: string;
}

function buildArtifactScrollFilter(adapterId: string) {
  return buildSpaceFilter(getSearchSpaceIds(), {
    must: [
      { key: 'adapter.id', match: { value: adapterId } },
      { key: 'content_type', match: { any: [...ALLOWED_ARTIFACT_MIMES] } }
    ]
  });
}

function toArtifactMetadata(point: { id: unknown; payload?: Record<string, unknown> }, adapterId: string): AdapterArtifactMetadata | null {
  const payload = (point.payload ?? {}) as Record<string, unknown>;
  const artifactPayload = (payload['artifact'] ?? {}) as Record<string, unknown>;
  const idRaw = point.id;
  const artifactUuid =
    typeof idRaw === 'string' ? idRaw : typeof idRaw === 'number' ? String(idRaw) : '';
  if (!artifactUuid) return null;

  const name =
    typeof artifactPayload['name'] === 'string' && artifactPayload['name'].trim().length > 0
      ? artifactPayload['name'].trim()
      : typeof payload['label'] === 'string' && payload['label'].trim().length > 0
        ? payload['label'].trim()
        : artifactUuid;
  const slug =
    typeof artifactPayload['slug'] === 'string' && artifactPayload['slug'].trim().length > 0
      ? artifactPayload['slug'].trim()
      : artifactUuid;
  const version =
    typeof artifactPayload['version'] === 'string' && artifactPayload['version'].trim().length > 0
      ? artifactPayload['version'].trim()
      : '1';
  const sha256 = typeof artifactPayload['sha256'] === 'string' ? artifactPayload['sha256'] : '';
  const relativePath =
    typeof artifactPayload['relative_path'] === 'string' && artifactPayload['relative_path'].trim().length > 0
      ? artifactPayload['relative_path'].trim()
      : null;
  const contentType =
    typeof payload['content_type'] === 'string' && payload['content_type'].trim().length > 0
      ? payload['content_type'].trim()
      : 'text/plain';
  const adapterObject = payload['adapter'] as { id?: string; name?: string } | undefined;
  const adapterName = typeof adapterObject?.name === 'string' ? adapterObject.name : null;

  return {
    artifact_uuid: artifactUuid,
    adapter_id: adapterId,
    adapter_name: adapterName,
    label: typeof payload['label'] === 'string' ? payload['label'] : name,
    slug,
    version,
    name,
    relative_path: relativePath,
    sha256,
    content_type: contentType,
    tags: Array.isArray(payload['tags']) ? payload['tags'].map((tag) => String(tag)) : [],
    text: typeof payload['text'] === 'string' ? payload['text'] : ''
  };
}

export async function listAdapterArtifacts(
  memoryStore: MemoryQdrantStore,
  adapterId: string
): Promise<AdapterArtifactMetadata[]> {
  const { client, collection } = memoryStore.getQdrantAccess();
  const artifacts: AdapterArtifactMetadata[] = [];
  let offset: string | number | undefined;

  do {
    const page = await client.scroll(collection, {
      filter: buildArtifactScrollFilter(adapterId),
      limit: 256,
      ...(offset !== undefined ? { offset } : {}),
      with_payload: true,
      with_vector: false
    });
    const points = Array.isArray(page?.points) ? page.points : [];
    for (const point of points) {
      const row = toArtifactMetadata(
        point as { id: unknown; payload?: Record<string, unknown> },
        adapterId
      );
      if (row) {
        artifacts.push(row);
      }
    }
    const nextOffset = page?.next_page_offset;
    offset =
      typeof nextOffset === 'string' || typeof nextOffset === 'number'
        ? nextOffset
        : undefined;
  } while (offset !== null && offset !== undefined);

  artifacts.sort((a, b) => a.name.localeCompare(b.name) || a.artifact_uuid.localeCompare(b.artifact_uuid));
  return artifacts;
}

