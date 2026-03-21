import type { ExecutionTrace, RewardRecord, TensorValue } from '../types/memory.js';
import { keyValueStore } from './key-value-store-factory.js';
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

function executionMetaKey(executionId: string): string {
  return `trace:execution:${executionId}:meta`;
}

function executionLayersKey(executionId: string): string {
  return `trace:execution:${executionId}:layers`;
}

function adapterExecutionsKey(adapterId: string): string {
  return `trace:adapter:${adapterId}:executions`;
}

export class ExecutionTraceStore {
  async startExecution(params: {
    executionId: string;
    adapterId: string;
    adapterUri: string;
    activationQuery?: string;
  }): Promise<void> {
    const { executionId, adapterId, adapterUri, activationQuery } = params;
    await keyValueStore.setJson(executionMetaKey(executionId), {
      execution_id: executionId,
      adapter_id: adapterId,
      adapter_uri: adapterUri,
      activation_query: activationQuery
    });
    await keyValueStore.hset(adapterExecutionsKey(adapterId), executionId, new Date().toISOString());
  }

  async appendTrace(trace: ExecutionTrace): Promise<void> {
    const field = `${trace.layer_index}:${trace.layer_uri}`;
    await keyValueStore.hset(executionLayersKey(trace.execution_id), field, JSON.stringify(trace));
  }

  async setReward(executionId: string, reward: RewardRecord): Promise<void> {
    const meta = await keyValueStore.getJson<Record<string, unknown>>(executionMetaKey(executionId));
    if (!meta) {
      return;
    }
    await keyValueStore.setJson(executionMetaKey(executionId), {
      ...meta,
      reward
    });
  }

  async getExecution(executionId: string): Promise<StoredExecutionTrace | null> {
    const meta = await keyValueStore.getJson<Record<string, unknown>>(executionMetaKey(executionId));
    if (!meta) {
      return null;
    }
    const rawTraces = await keyValueStore.hgetall(executionLayersKey(executionId));
    const traces = Object.values(rawTraces ?? {})
      .map((value) => {
        try {
          return JSON.parse(value) as ExecutionTrace;
        } catch {
          return null;
        }
      })
      .filter((value): value is ExecutionTrace => value !== null)
      .sort((a, b) => a.layer_index - b.layer_index);

    return {
      execution_id: String(meta['execution_id']),
      adapter_id: String(meta['adapter_id']),
      adapter_uri: String(meta['adapter_uri']),
      ...(typeof meta['activation_query'] === 'string' ? { activation_query: meta['activation_query'] } : {}),
      ...(meta['reward'] && typeof meta['reward'] === 'object' ? { reward: meta['reward'] as RewardRecord } : {}),
      traces
    };
  }

  async listAdapterExecutions(adapterId: string): Promise<string[]> {
    const values = await keyValueStore.hgetall(adapterExecutionsKey(adapterId));
    return Object.keys(values ?? {});
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
    try {
      await keyValueStore.del(executionMetaKey(executionId));
      await keyValueStore.del(executionLayersKey(executionId));
    } catch (error) {
      logger.warn(
        `[ExecutionTraceStore] Failed to delete execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const executionTraceStore = new ExecutionTraceStore();

