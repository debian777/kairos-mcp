import { MemoryQdrantStore } from '../services/memory/store.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';

export const SYSTEM_PROTOCOL_UUID_BY_SLUG: Record<string, string> = {
  'create-new-protocol': '00000000-0000-0000-0000-000000002001',
  'refine-search': '00000000-0000-0000-0000-000000002002',
  'create-new-protocol-review': '00000000-0000-0000-0000-000000002003',
  'challenge-type-guide': '00000000-0000-0000-0000-000000002004',
  'phase-critic': '00000000-0000-0000-0000-000000002005',
  'protocol-linking-guide': '00000000-0000-0000-0000-000000002006'
};

export async function assertSystemProtocolStaticUuids(memoryStore: MemoryQdrantStore): Promise<void> {
  const { client, collection } = memoryStore.getQdrantAccess();
  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const [slug, uuid] of Object.entries(SYSTEM_PROTOCOL_UUID_BY_SLUG)) {
    const retrieved = await client.retrieve(collection, {
      ids: [uuid],
      with_payload: true,
      with_vector: false
    });
    const point = retrieved?.[0];
    if (!point) {
      missing.push(`${slug} -> ${uuid}`);
      continue;
    }

    const payload = (point.payload ?? {}) as Record<string, unknown>;
    const pointSlug = typeof payload['slug'] === 'string' ? payload['slug'] : null;
    const pointSpaceId = typeof payload['space_id'] === 'string' ? payload['space_id'] : null;
    if (pointSlug !== slug || pointSpaceId !== KAIROS_APP_SPACE_ID) {
      mismatched.push(
        `${uuid} expected(slug=${slug},space=${KAIROS_APP_SPACE_ID}) actual(slug=${pointSlug ?? 'null'},space=${pointSpaceId ?? 'null'})`
      );
    }
  }

  if (missing.length > 0 || mismatched.length > 0) {
    throw new Error(
      `[mem-resources-boot] Static system protocol invariant failed. ` +
      `missing=[${missing.join('; ')}] mismatched=[${mismatched.join('; ')}]`
    );
  }
}