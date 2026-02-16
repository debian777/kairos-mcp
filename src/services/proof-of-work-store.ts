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

/** TTL for nonce (1 hour). */
const NONCE_TTL_SEC = 3600;
/** TTL for proof hash (7 days, same as result). */
const HASH_TTL_SEC = 604800;
/** TTL for retry counter (1 hour). Resets naturally after inactivity. */
const RETRY_TTL_SEC = 3600;
/** Max retries before escalating to must_obey: false. */
export const MAX_RETRIES = 3;

export class ProofOfWorkStore {
  private readonly prefix = 'pow:result:';
  private readonly noncePrefix = 'pow:nonce:';
  private readonly hashPrefix = 'pow:hash:';
  private readonly retryPrefix = 'pow:retry:';

  private buildKey(uuid: string): string {
    return `${this.prefix}${uuid}`;
  }

  private nonceKey(uuid: string): string {
    return `${this.noncePrefix}${uuid}`;
  }

  private hashKey(uuid: string): string {
    return `${this.hashPrefix}${uuid}`;
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

  async setNonce(memoryUuid: string, nonce: string): Promise<void> {
    if (!memoryUuid || !nonce) return;
    try {
      await redisService.set(this.nonceKey(memoryUuid), nonce, NONCE_TTL_SEC);
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to set nonce for ${memoryUuid}`, error);
    }
  }

  async getNonce(memoryUuid: string): Promise<string | null> {
    if (!memoryUuid) return null;
    try {
      return await redisService.get(this.nonceKey(memoryUuid));
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to get nonce for ${memoryUuid}`, error);
      return null;
    }
  }

  async setProofHash(memoryUuid: string, hash: string): Promise<void> {
    if (!memoryUuid || !hash) return;
    try {
      await redisService.set(this.hashKey(memoryUuid), hash, HASH_TTL_SEC);
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to set proof hash for ${memoryUuid}`, error);
    }
  }

  async getProofHash(memoryUuid: string): Promise<string | null> {
    if (!memoryUuid) return null;
    try {
      return await redisService.get(this.hashKey(memoryUuid));
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to get proof hash for ${memoryUuid}`, error);
      return null;
    }
  }

  private retryKey(uuid: string): string {
    return `${this.retryPrefix}${uuid}`;
  }

  async incrementRetry(memoryUuid: string): Promise<number> {
    if (!memoryUuid) return 0;
    try {
      const count = await redisService.incr(this.retryKey(memoryUuid));
      await redisService.set(this.retryKey(memoryUuid), String(count), RETRY_TTL_SEC);
      return count;
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to increment retry for ${memoryUuid}`, error);
      return 0;
    }
  }

  async getRetryCount(memoryUuid: string): Promise<number> {
    if (!memoryUuid) return 0;
    try {
      const val = await redisService.get(this.retryKey(memoryUuid));
      return val ? parseInt(val, 10) : 0;
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to get retry count for ${memoryUuid}`, error);
      return 0;
    }
  }

  async resetRetry(memoryUuid: string): Promise<void> {
    if (!memoryUuid) return;
    try {
      await redisService.set(this.retryKey(memoryUuid), '0', RETRY_TTL_SEC);
    } catch (error) {
      logger.error(`[ProofOfWorkStore] Failed to reset retry for ${memoryUuid}`, error);
    }
  }
}

export const proofOfWorkStore = new ProofOfWorkStore();

