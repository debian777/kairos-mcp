import { keyValueStore } from './key-value-store-factory.js';
import type { SpaceContext } from '../utils/tenant-context.js';

export interface ExportDownloadCapabilityRecord {
  id: string;
  adapter_uris: string[];
  primary_uri: string;
  item_count: number;
  adapter_name: string | null;
  adapter_version: string | null;
  skill_bundle_manifest: string;
  expires_at: string;
  space_context: SpaceContext;
}

export class ExportDownloadCapabilityStore {
  private readonly prefix = 'mem:export-download:';

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  async put(record: ExportDownloadCapabilityRecord, ttlSeconds: number): Promise<void> {
    await keyValueStore.setJson(this.key(record.id), record, ttlSeconds);
  }

  async get(id: string): Promise<ExportDownloadCapabilityRecord | null> {
    return keyValueStore.getJson<ExportDownloadCapabilityRecord>(this.key(id));
  }
}

export const exportDownloadCapabilityStore = new ExportDownloadCapabilityStore();
