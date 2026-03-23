import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExecutionTrace, RewardRecord, TensorValue } from '../types/memory.js';
import { KAIROS_TRACE_STORE_DIR } from '../config.js';
import { logger } from '../utils/structured-logger.js';

export interface TrainingPair {
  id: string;
  execution_id: string;
  adapter_uri: string;
  layer_uri: string;
  layer_index: number;
  timestamp: string;
  instruction: {
    activation_query?: string;
    tensor_in: Record<string, unknown>;
    layer_instructions: string;
  };
  response: {
    tensor_out?: TensorValue;
    trace?: string;
    raw_solution?: unknown;
  };
  reward?: RewardRecord;
}

export interface StoredExecutionTrace {
  execution_id: string;
  adapter_id: string;
  adapter_uri: string;
  activation_query?: string;
  reward?: RewardRecord;
  traces: ExecutionTrace[];
}

interface AdapterExecutionIndex {
  adapter_id: string;
  execution_ids: string[];
}

function safeFileId(id: string): string {
  return encodeURIComponent(id);
}

function adapterIdFromUri(adapterUri: string): string {
  return adapterUri.split('/').pop() ?? adapterUri;
}

export class ExecutionTraceStore {
  private readonly executionsDir: string;
  private readonly adaptersDir: string;
  private initPromise: Promise<void> | null = null;
  private readonly mutationChains = new Map<string, Promise<void>>();

  constructor(rootDir: string = KAIROS_TRACE_STORE_DIR) {
    this.executionsDir = path.join(rootDir, 'executions');
    this.adaptersDir = path.join(rootDir, 'adapters');
  }

  private async ensureReady(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = Promise.all([
        fs.mkdir(this.executionsDir, { recursive: true }),
        fs.mkdir(this.adaptersDir, { recursive: true })
      ]).then(() => undefined);
    }
    await this.initPromise;
  }

  private executionFile(executionId: string): string {
    return path.join(this.executionsDir, `${safeFileId(executionId)}.json`);
  }

  private adapterIndexFile(adapterId: string): string {
    return path.join(this.adaptersDir, `${safeFileId(adapterId)}.json`);
  }

  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      const message = `[ExecutionTraceStore] Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(message);
      throw new Error(message, { cause: error instanceof Error ? error : undefined });
    }
  }

  private async writeJsonFile(filePath: string, value: unknown): Promise<void> {
    await this.ensureReady();
    const tempFile = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const serialized = JSON.stringify(value, null, 2);
    try {
      const handle = await fs.open(tempFile, 'w');
      try {
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(tempFile, filePath);
      const dirHandle = await fs.open(path.dirname(filePath), 'r');
      try {
        await dirHandle.sync();
      } finally {
        await dirHandle.close();
      }
    } catch (error) {
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore temp cleanup failures; the original write error is the actionable signal.
      }
      throw error;
    }
  }

  private async withMutationLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.mutationChains.get(key) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.catch(() => undefined).then(() => gate);
    this.mutationChains.set(key, next);
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release?.();
      if (this.mutationChains.get(key) === next) {
        this.mutationChains.delete(key);
      }
    }
  }

  private async withExecutionMutation<T>(executionId: string, task: () => Promise<T>): Promise<T> {
    return this.withMutationLock(`execution:${executionId}`, task);
  }

  private async withAdapterMutation<T>(adapterId: string, task: () => Promise<T>): Promise<T> {
    return this.withMutationLock(`adapter:${adapterId}`, task);
  }

  private async readAdapterIndex(adapterId: string): Promise<AdapterExecutionIndex> {
    return (
      (await this.readJsonFile<AdapterExecutionIndex>(this.adapterIndexFile(adapterId))) ?? {
        adapter_id: adapterId,
        execution_ids: []
      }
    );
  }
  private async writeAdapterIndex(adapterId: string, executionIds: string[]): Promise<void> {
    const uniqueExecutionIds = Array.from(new Set(executionIds));
    if (uniqueExecutionIds.length === 0) {
      try {
        await fs.unlink(this.adapterIndexFile(adapterId));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(
            `[ExecutionTraceStore] Failed to delete adapter index ${adapterId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      return;
    }
    await this.writeJsonFile(this.adapterIndexFile(adapterId), {
      adapter_id: adapterId,
      execution_ids: uniqueExecutionIds
    } satisfies AdapterExecutionIndex);
  }

  async startExecution(params: {
    executionId: string;
    adapterId: string;
    adapterUri: string;
    activationQuery?: string;
  }): Promise<void> {
    const { executionId, adapterId, adapterUri, activationQuery } = params;
    await this.withAdapterMutation(adapterId, async () => {
      await this.withExecutionMutation(executionId, async () => {
        const existing = await this.getExecution(executionId);
        const resolvedActivationQuery = activationQuery ?? existing?.activation_query;
        if (existing && existing.adapter_id !== adapterId) {
          throw new Error(
            `Execution ${executionId} already belongs to adapter ${existing.adapter_id}; refusing to reassign it to ${adapterId}`
          );
        }
        const stored: StoredExecutionTrace = {
          execution_id: executionId,
          adapter_id: adapterId,
          adapter_uri: adapterUri,
          ...(resolvedActivationQuery ? { activation_query: resolvedActivationQuery } : {}),
          ...(existing?.reward ? { reward: existing.reward } : {}),
          traces: existing?.traces ?? []
        };
        await this.writeJsonFile(this.executionFile(executionId), stored);
        const adapterIndex = await this.readAdapterIndex(adapterId);
        await this.writeAdapterIndex(adapterId, [...adapterIndex.execution_ids, executionId]);
      });
    });
  }
  async appendTrace(trace: ExecutionTrace): Promise<void> {
    const adapterId = adapterIdFromUri(trace.adapter_uri);
    await this.withAdapterMutation(adapterId, async () => {
      await this.withExecutionMutation(trace.execution_id, async () => {
        const executionFile = this.executionFile(trace.execution_id);
        const existing = await this.getExecution(trace.execution_id);
        if (existing && existing.adapter_uri !== trace.adapter_uri) {
          throw new Error(
            `Execution ${trace.execution_id} already points at ${existing.adapter_uri}; refusing to append a trace for ${trace.adapter_uri}`
          );
        }
        const stored: StoredExecutionTrace = existing ?? {
          execution_id: trace.execution_id,
          adapter_id: adapterId,
          adapter_uri: trace.adapter_uri,
          ...(trace.activation_query ? { activation_query: trace.activation_query } : {}),
          traces: []
        };
        const key = `${trace.layer_index}:${trace.layer_uri}`;
        const tracesByKey = new Map(
          stored.traces.map((existingTrace) => [
            `${existingTrace.layer_index}:${existingTrace.layer_uri}`,
            existingTrace
          ])
        );
        tracesByKey.set(key, trace);
        await this.writeJsonFile(executionFile, {
          ...stored,
          traces: Array.from(tracesByKey.values()).sort((a, b) => a.layer_index - b.layer_index)
        } satisfies StoredExecutionTrace);
        const adapterIndex = await this.readAdapterIndex(stored.adapter_id);
        await this.writeAdapterIndex(stored.adapter_id, [...adapterIndex.execution_ids, trace.execution_id]);
      });
    });
  }

  async setReward(executionId: string, reward: RewardRecord): Promise<void> {
    await this.withExecutionMutation(executionId, async () => {
      const existing = await this.getExecution(executionId);
      if (!existing) {
        logger.warn(`[ExecutionTraceStore] Skipping reward for missing execution ${executionId}`);
        return;
      }
      await this.writeJsonFile(this.executionFile(executionId), {
        ...existing,
        reward
      } satisfies StoredExecutionTrace);
    });
  }

  async getExecution(executionId: string): Promise<StoredExecutionTrace | null> {
    await this.ensureReady();
    const stored = await this.readJsonFile<StoredExecutionTrace>(this.executionFile(executionId));
    if (!stored) {
      return null;
    }
    return {
      ...stored,
      traces: [...stored.traces].sort((a, b) => a.layer_index - b.layer_index)
    };
  }

  async listAdapterExecutions(adapterId: string): Promise<string[]> {
    const index = await this.readAdapterIndex(adapterId);
    return index.execution_ids;
  }

  async buildTrainingPairsForAdapter(adapterId: string, includeReward: boolean = true): Promise<TrainingPair[]> {
    const executionIds = await this.listAdapterExecutions(adapterId);
    const pairs: TrainingPair[] = [];

    for (const executionId of executionIds) {
      const execution = await this.getExecution(executionId);
      if (!execution) {
        continue;
      }
      for (const trace of execution.traces) {
        pairs.push({
          id: `${execution.execution_id}:${trace.layer_index}`,
          execution_id: execution.execution_id,
          adapter_uri: execution.adapter_uri,
          layer_uri: trace.layer_uri,
          layer_index: trace.layer_index,
          timestamp: trace.created_at,
          instruction: {
            tensor_in: trace.tensor_in,
            ...(execution.activation_query ? { activation_query: execution.activation_query } : {}),
            layer_instructions: trace.layer_instructions ?? ''
          },
          response: {
            ...(trace.tensor_out ? { tensor_out: trace.tensor_out } : {}),
            ...(trace.trace ? { trace: trace.trace } : {}),
            ...(trace.raw_solution !== undefined ? { raw_solution: trace.raw_solution } : {})
          },
          ...(includeReward && execution.reward ? { reward: execution.reward } : {})
        });
      }
    }

    return pairs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async deleteExecution(executionId: string): Promise<void> {
    const existing = await this.getExecution(executionId);
    if (!existing) {
      await this.withExecutionMutation(executionId, async () => {
        try {
          await fs.unlink(this.executionFile(executionId));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn(
              `[ExecutionTraceStore] Failed to delete execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      });
      return;
    }

    await this.withAdapterMutation(existing.adapter_id, async () => {
      await this.withExecutionMutation(executionId, async () => {
        try {
          const latest = await this.getExecution(executionId);
          if (latest) {
            const adapterIndex = await this.readAdapterIndex(latest.adapter_id);
            await this.writeAdapterIndex(
              latest.adapter_id,
              adapterIndex.execution_ids.filter((id) => id !== executionId)
            );
          }
          await fs.unlink(this.executionFile(executionId));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn(
              `[ExecutionTraceStore] Failed to delete execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      });
    });
  }
}
export const executionTraceStore = new ExecutionTraceStore();

