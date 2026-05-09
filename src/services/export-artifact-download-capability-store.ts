import { keyValueStore } from './key-value-store-factory.js';
import type { SpaceContext } from '../utils/tenant-context.js';

export interface ExportArtifactDownloadCapabilityRecord {
  id: string;
  artifact_uuid: string;
  filename: string;
  content_type: string;
  sha256: string;
  relative_path: string | null;
  expires_at: string;
  space_context: SpaceContext;
}

export class ExportArtifactDownloadCapabilityStore {
  private readonly prefix = 'mem:export-artifact-download:';

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  async put(record: ExportArtifactDownloadCapabilityRecord, ttlSeconds: number): Promise<void> {
    await keyValueStore.setJson(this.key(record.id), record, ttlSeconds);
  }

  async get(id: string): Promise<ExportArtifactDownloadCapabilityRecord | null> {
    return keyValueStore.getJson<ExportArtifactDownloadCapabilityRecord>(this.key(id));
  }
}

export const exportArtifactDownloadCapabilityStore = new ExportArtifactDownloadCapabilityStore();

