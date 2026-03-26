import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ExecutionTrace } from '../../src/types/memory.js';
import { ExecutionTraceStore } from '../../src/services/execution-trace-store.js';

function buildTrace(params: {
  executionId: string;
  adapterUri: string;
  layerIndex: number;
  layerId: string;
  createdAt: string;
}): ExecutionTrace {
  const { executionId, adapterUri, layerIndex, layerId, createdAt } = params;
  return {
    execution_id: executionId,
    adapter_uri: adapterUri,
    layer_uri: `kairos://mem/${layerId}/${executionId}`,
    layer_index: layerIndex,
    created_at: createdAt,
    layer_instructions: `Layer ${layerIndex} instructions`,
    tensor_in: { prompt: `prompt-${layerIndex}` },
    tensor_out: { name: `tensor_${layerIndex}`, value: `value-${layerIndex}` },
    raw_solution: { comment: { text: `solution-${layerIndex}` } },
    merge_depth: 0
  };
}

describe('ExecutionTraceStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kairos-trace-store-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('persists executions, traces, and rewards on disk across store instances', async () => {
    const store = new ExecutionTraceStore(tempDir);
    const executionId = 'exec-1';
    const adapterId = 'adapter-1';
    const adapterUri = 'kairos://adapter/adapter-1';

    await store.startExecution({
      executionId,
      adapterId,
      adapterUri,
      activationQuery: 'summarize the customer issue'
    });

    await Promise.all([
      store.appendTrace(
        buildTrace({
          executionId,
          adapterUri,
          layerIndex: 2,
          layerId: 'layer-2',
          createdAt: '2026-03-22T10:01:00.000Z'
        })
      ),
      store.appendTrace(
        buildTrace({
          executionId,
          adapterUri,
          layerIndex: 1,
          layerId: 'layer-1',
          createdAt: '2026-03-22T10:00:00.000Z'
        })
      )
    ]);

    await store.setReward(executionId, {
      outcome: 'success',
      score: 0.95,
      signed_score: 0.95,
      quality_bonus: 0.95,
      grader_kind: 'human',
      evaluation_label: 'gold',
      exportable_for_sft: true,
      exportable_for_preference: false,
      rated_at: '2026-03-22T10:05:00.000Z'
    });

    const executionPath = path.join(tempDir, 'executions', `${encodeURIComponent(executionId)}.json`);
    const adapterIndexPath = path.join(tempDir, 'adapters', `${encodeURIComponent(adapterId)}.json`);
    const executionOnDisk = JSON.parse(await fs.readFile(executionPath, 'utf8')) as {
      traces: Array<{ layer_index: number }>;
      reward?: { outcome: string };
    };
    const adapterIndexOnDisk = JSON.parse(await fs.readFile(adapterIndexPath, 'utf8')) as {
      execution_ids: string[];
    };

    expect(executionOnDisk.traces.map((trace) => trace.layer_index)).toEqual([1, 2]);
    expect(executionOnDisk.reward?.outcome).toBe('success');
    expect(adapterIndexOnDisk.execution_ids).toEqual([executionId]);

    const reloadedStore = new ExecutionTraceStore(tempDir);
    const execution = await reloadedStore.getExecution(executionId);
    const pairs = await reloadedStore.buildTrainingPairsForAdapter(adapterId, true);

    expect(execution).not.toBeNull();
    expect(execution?.activation_query).toBe('summarize the customer issue');
    expect(execution?.traces.map((trace) => trace.layer_index)).toEqual([1, 2]);
    expect(await reloadedStore.listAdapterExecutions(adapterId)).toEqual([executionId]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.reward?.outcome).toBe('success');
    expect(pairs[1]?.reward?.outcome).toBe('success');
  });

  test('restarting the same execution preserves existing traces and delete cleans adapter indexes', async () => {
    const store = new ExecutionTraceStore(tempDir);
    const executionId = 'exec-2';
    const adapterId = 'adapter-2';
    const adapterUri = 'kairos://adapter/adapter-2';

    await store.startExecution({
      executionId,
      adapterId,
      adapterUri,
      activationQuery: 'draft the response'
    });
    await store.appendTrace(
      buildTrace({
        executionId,
        adapterUri,
        layerIndex: 1,
        layerId: 'layer-1',
        createdAt: '2026-03-22T11:00:00.000Z'
      })
    );

    await store.startExecution({
      executionId,
      adapterId,
      adapterUri,
      activationQuery: 'draft the response'
    });

    const execution = await store.getExecution(executionId);
    expect(execution?.traces).toHaveLength(1);

    await store.deleteExecution(executionId);

    expect(await store.getExecution(executionId)).toBeNull();
    expect(await store.listAdapterExecutions(adapterId)).toEqual([]);
  });
});
