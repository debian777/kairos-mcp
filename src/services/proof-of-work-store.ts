import { redisService } from './redis.js';
import { logger } from '../utils/logger.js';

export type ProofOfWorkStatus = 'success' | 'failed';
export type ProofOfWorkType = 'shell' | 'mcp' | 'user_input' | 'comment';

export interface ProofOfWorkResultRecord {
  result_id: string;
  type?: ProofOfWorkType;  // Optional for backward compatibility
  status: ProofOfWorkStatus;
  executed_at: string;
  // Legacy shell fields (backward compatible)
  exit_code?: number;
  duration_seconds?: number;
  stdout?: string;
  stderr?: string;
  // Type-specific result fields
  shell?: {
    exit_code: number;
    stdout?: string;
    stderr?: string;
    duration_seconds?: number;
  };
  mcp?: {
    tool_name: string;
    arguments?: any;
    result: any;
    success: boolean;
  };
  user_input?: {
    confirmation: string;
    timestamp?: string;
  };
  comment?: {
    text: string;
  };
}

export class ProofOfWorkStore {
  private readonly prefix = 'pow:result:';

  private buildKey(uuid: string): string {
    return `${this.prefix}${uuid}`;
  }

  async saveResult(memoryUuid: string, record: ProofOfWorkResultRecord): Promise<void> {
    if (!memoryUuid) return;
    try {
      // 7 days TTL (604800 seconds)
      await redisService.setJson(this.buildKey(memoryUuid), record, 604800);
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

