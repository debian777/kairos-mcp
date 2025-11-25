import { redisService } from './redis.js';
import { logger } from '../utils/logger.js';

export type ProofOfWorkStatus = 'success' | 'failed';

export interface ProofOfWorkResultRecord {
  result_id: string;
  status: ProofOfWorkStatus;
  exit_code: number;
  executed_at: string;
  duration_seconds?: number;
  stdout?: string;
  stderr?: string;
}

export class ProofOfWorkStore {
  private readonly prefix = 'pow:result:';

  private buildKey(uuid: string): string {
    return `${this.prefix}${uuid}`;
  }

  async saveResult(memoryUuid: string, record: ProofOfWorkResultRecord): Promise<void> {
    if (!memoryUuid) return;
    try {
      await redisService.setJson(this.buildKey(memoryUuid), record);
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to save result for ${memoryUuid}`, error);
    }
  }

  async getResult(memoryUuid: string): Promise<ProofOfWorkResultRecord | null> {
    if (!memoryUuid) return null;
    try {
      return await redisService.getJson<ProofOfWorkResultRecord>(this.buildKey(memoryUuid));
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to load result for ${memoryUuid}`, error);
      return null;
    }
  }
}

export const proofOfWorkStore = new ProofOfWorkStore();

