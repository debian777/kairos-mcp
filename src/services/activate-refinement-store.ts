import { keyValueStore } from './key-value-store-factory.js';
import { logger } from '../utils/structured-logger.js';

const REFINE_COUNT_TTL_SEC = 3600;

export class ActivateRefinementStore {
  private readonly refinePrefix = 'activate:refine_count:';

  private refineKey(executionId: string): string {
    return `${this.refinePrefix}${executionId}`;
  }

  async incrementRefineCount(executionId: string): Promise<number> {
    if (!executionId) return 0;
    try {
      const count = await keyValueStore.incr(this.refineKey(executionId));
      await keyValueStore.set(this.refineKey(executionId), String(count), REFINE_COUNT_TTL_SEC);
      return count;
    } catch (error) {
      logger.error(`[ActivateRefinementStore] Failed to increment refine count for ${executionId}`, error);
      return 0;
    }
  }

  async getRefineCount(executionId: string): Promise<number> {
    if (!executionId) return 0;
    try {
      const value = await keyValueStore.get(this.refineKey(executionId));
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error(`[ActivateRefinementStore] Failed to get refine count for ${executionId}`, error);
      return 0;
    }
  }

  async resetRefineCount(executionId: string): Promise<void> {
    if (!executionId) return;
    try {
      await keyValueStore.set(this.refineKey(executionId), '0', REFINE_COUNT_TTL_SEC);
    } catch (error) {
      logger.error(`[ActivateRefinementStore] Failed to reset refine count for ${executionId}`, error);
    }
  }
}

export const activateRefinementStore = new ActivateRefinementStore();

