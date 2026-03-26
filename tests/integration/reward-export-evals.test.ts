import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { getTestSpaceId } from '../utils/auth-headers.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';
import { getEvalFailures, runEvalSuite } from '../workflow-test/eval-harness.js';

function parseJsonl(content: string): unknown[] {
  const trimmed = content.trim();
  return trimmed ? trimmed.split('\n').map((line) => JSON.parse(line)) : [];
}

describe('workflow eval harness: reward export readiness', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  async function trainSingleStepAdapter(label: string): Promise<{ adapterUri: string }> {
    const trainArgs: {
      markdown_doc: string;
      llm_model_id: string;
      force_update: boolean;
      space?: string;
    } = {
      markdown_doc: buildProofMarkdown(label, [
        { heading: 'Step One', body: `Complete the task for ${label}.`, proofCmd: 'echo done' }
      ]),
      llm_model_id: 'test-reward-export-evals',
      force_update: true
    };
    const spaceId = getTestSpaceId();
    if (spaceId) {
      trainArgs.space = spaceId;
    }

    const trainResult = await mcpConnection.client.callTool({
      name: 'train',
      arguments: trainArgs
    });
    const stored = parseMcpJson(trainResult, 'reward export eval train');
    expect(stored.status).toBe('stored');
    return { adapterUri: stored.items[0].adapter_uri as string };
  }

  async function finishSingleStepRun(adapterUri: string, stdout: string): Promise<{ completionLayerUri: string }> {
    const openResult = await mcpConnection.client.callTool({
      name: 'forward',
      arguments: { uri: adapterUri }
    });
    const openPayload = parseMcpJson(openResult, 'reward export eval forward open');
    const completionResult = await mcpConnection.client.callTool({
      name: 'forward',
      arguments: {
        uri: openPayload.current_layer.uri,
        solution: {
          type: 'shell',
          nonce: openPayload.contract?.nonce,
          proof_hash: openPayload.contract?.proof_hash ?? openPayload.contract?.genesis_hash,
          shell: { exit_code: 0, stdout }
        }
      }
    });
    const completionPayload = parseMcpJson(completionResult, 'reward export eval forward complete');
    return { completionLayerUri: completionPayload.current_layer.uri as string };
  }

  async function rewardRun(args: {
    uri: string;
    outcome: 'success' | 'failure';
    feedback: string;
    score?: number;
    rubric_version?: string;
    llm_model_id?: string;
  }): Promise<void> {
    const result = await mcpConnection.client.callTool({
      name: 'reward',
      arguments: args
    });
    const parsed = parseMcpJson(result, 'reward export eval reward');
    expect(parsed.total_rated).toBeGreaterThanOrEqual(1);
    expect(parsed.total_failed).toBe(0);
  }

  async function exportFormat(
    adapterUri: string,
    format: 'trace_jsonl' | 'reward_jsonl' | 'sft_jsonl' | 'preference_jsonl'
  ): Promise<{ item_count: number; content: string }> {
    const result = await mcpConnection.client.callTool({
      name: 'export',
      arguments: { uri: adapterUri, format, include_reward: true }
    });
    return parseMcpJson(result, `reward export eval export ${format}`) as {
      item_count: number;
      content: string;
    };
  }

  test('code-graded reward export cases pass through the workflow eval harness', async () => {
    const suite = await runEvalSuite([
      {
        id: 'ungraded-reward-stays-out-of-sft-export',
        run: async () => {
          const label = `RewardEval Ungraded ${Date.now()}`;
          const { adapterUri } = await trainSingleStepAdapter(label);
          const { completionLayerUri } = await finishSingleStepRun(adapterUri, 'done');
          await rewardRun({
            uri: completionLayerUri,
            outcome: 'success',
            feedback: 'completed without rubric metadata'
          });

          const traceExport = await exportFormat(adapterUri, 'trace_jsonl');
          const rewardExport = await exportFormat(adapterUri, 'reward_jsonl');
          const sftExport = await exportFormat(adapterUri, 'sft_jsonl');
          const traceItems = parseJsonl(traceExport.content) as Array<{
            reward?: { exportable_for_sft?: boolean; sft_blockers?: string[] };
          }>;
          const rewardItems = parseJsonl(rewardExport.content) as Array<{
            reward?: {
              exportable_for_sft?: boolean;
              sft_blockers?: string[];
              rated_at?: string;
            };
            metadata?: {
              execution_id?: string;
              layer_uri?: string;
            };
          }>;
          const reward = traceItems[0]?.reward;

          return {
            metrics: {
              trace_item_count: traceExport.item_count,
              reward_item_count: rewardExport.item_count,
              sft_item_count: sftExport.item_count
            },
            checks: [
              {
                name: 'trace export captures the rewarded execution',
                passed: traceExport.item_count === 1,
                details: traceExport
              },
              {
                name: 'reward stores explicit blockers when rubric metadata is missing',
                passed:
                  reward?.exportable_for_sft === false &&
                  reward.sft_blockers?.includes('missing_rubric_version') === true &&
                  reward.sft_blockers?.includes('missing_evaluator_identity') === true,
                details: reward
              },
              {
                name: 'reward export keeps blocked rewards in a normalized dataset row',
                passed:
                  rewardExport.item_count === 1 &&
                  rewardItems[0]?.reward?.exportable_for_sft === false &&
                  rewardItems[0].reward?.sft_blockers?.includes('missing_rubric_version') === true &&
                  typeof rewardItems[0]?.reward?.rated_at === 'string' &&
                  typeof rewardItems[0]?.metadata?.execution_id === 'string' &&
                  typeof rewardItems[0]?.metadata?.layer_uri === 'string' &&
                  !rewardItems[0].metadata.layer_uri.includes('?execution_id='),
                details: rewardItems
              },
              {
                name: 'sft export remains gated without structured evaluator metadata',
                passed: sftExport.item_count === 0,
                details: sftExport
              }
            ]
          };
        }
      },
      {
        id: 'model-graded-rewards-feed-sft-and-preference-exports',
        run: async () => {
          const label = `RewardEval Model ${Date.now()}`;
          const { adapterUri } = await trainSingleStepAdapter(label);
          const successRun = await finishSingleStepRun(adapterUri, 'success');
          const failureRun = await finishSingleStepRun(adapterUri, 'failure');

          await rewardRun({
            uri: successRun.completionLayerUri,
            outcome: 'success',
            feedback: 'meets the rubric',
            score: 0.91,
            rubric_version: 'reward-v1',
            llm_model_id: 'grader-model-v1'
          });
          await rewardRun({
            uri: failureRun.completionLayerUri,
            outcome: 'failure',
            feedback: 'misses the rubric',
            score: 0.84,
            rubric_version: 'reward-v1',
            llm_model_id: 'grader-model-v1'
          });

          const traceExport = await exportFormat(adapterUri, 'trace_jsonl');
          const rewardExport = await exportFormat(adapterUri, 'reward_jsonl');
          const sftExport = await exportFormat(adapterUri, 'sft_jsonl');
          const preferenceExport = await exportFormat(adapterUri, 'preference_jsonl');
          const traceItems = parseJsonl(traceExport.content) as Array<{
            reward?: {
              outcome: 'success' | 'failure';
              llm_model_id?: string;
              rubric_version?: string;
              exportable_for_sft?: boolean;
              exportable_for_preference?: boolean;
            };
          }>;
          const rewardItems = parseJsonl(rewardExport.content) as Array<{
            instruction?: {
              activation_query?: string | null;
              tensor_in?: Record<string, unknown>;
              layer_instructions?: string;
            };
            response?: {
              raw_solution?: unknown;
            };
            reward?: {
              outcome?: 'success' | 'failure';
              llm_model_id?: string | null;
              rubric_version?: string | null;
              exportable_for_sft?: boolean;
              exportable_for_preference?: boolean;
            };
            metadata?: {
              execution_id?: string;
              layer_uri?: string;
            };
          }>;
          const sftItems = parseJsonl(sftExport.content) as Array<{
            metadata?: { reward?: { exportable_for_sft?: boolean } };
          }>;
          const preferenceItems = parseJsonl(preferenceExport.content) as Array<{
            chosen?: string;
            rejected?: string;
            metadata?: { layer_uri?: string };
          }>;

          return {
            metrics: {
              trace_item_count: traceExport.item_count,
              reward_item_count: rewardExport.item_count,
              sft_item_count: sftExport.item_count,
              preference_item_count: preferenceExport.item_count
            },
            checks: [
              {
                name: 'trace export keeps model grader metadata on every reward',
                passed: traceItems.every(
                  (item) =>
                    item.reward?.llm_model_id === 'grader-model-v1' &&
                    item.reward?.rubric_version === 'reward-v1'
                ),
                details: traceItems
              },
              {
                name: 'reward export keeps both rewarded runs in a stable schema',
                passed:
                  rewardExport.item_count === 2 &&
                  rewardItems.length === 2 &&
                  rewardItems.every(
                    (item) =>
                      typeof item.instruction?.layer_instructions === 'string' &&
                      typeof item.instruction?.tensor_in === 'object' &&
                      item.response?.raw_solution !== undefined &&
                      item.reward?.llm_model_id === 'grader-model-v1' &&
                      item.reward?.rubric_version === 'reward-v1' &&
                      typeof item.metadata?.execution_id === 'string' &&
                      typeof item.metadata?.layer_uri === 'string' &&
                      !item.metadata.layer_uri.includes('?execution_id=')
                  ) &&
                  rewardItems.some((item) => item.reward?.outcome === 'success') &&
                  rewardItems.some((item) => item.reward?.outcome === 'failure'),
                details: rewardItems
              },
              {
                name: 'graded success reward becomes sft exportable',
                passed:
                  sftExport.item_count === 1 &&
                  sftItems[0]?.metadata?.reward?.exportable_for_sft === true,
                details: sftItems
              },
              {
                name: 'success and failure rewards pair into one preference sample',
                passed:
                  preferenceExport.item_count === 1 &&
                  typeof preferenceItems[0]?.chosen === 'string' &&
                  typeof preferenceItems[0]?.rejected === 'string' &&
                  typeof preferenceItems[0]?.metadata?.layer_uri === 'string' &&
                  !preferenceItems[0].metadata.layer_uri.includes('?execution_id='),
                details: preferenceItems
              },
              {
                name: 'graded failure remains eligible for preference export',
                passed: traceItems.some(
                  (item) =>
                    item.reward?.outcome === 'failure' &&
                    item.reward?.exportable_for_preference === true
                ),
                details: traceItems
              }
            ]
          };
        }
      }
    ]);

    expect(getEvalFailures(suite)).toEqual([]);
  }, 60000);
});
