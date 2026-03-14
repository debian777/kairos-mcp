/**
 * Integration tests: attest propagation to chain head and attest-based score boost.
 * - Propagation: attest on completion step updates chain head quality_metrics (verified via score boost).
 * - Score boost: after MIN_ATTEST_RUNS successes, search score for that protocol increases.
 * - No boost when runs < MIN_ATTEST_RUNS: one attest does not change score.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

const MIN_ATTEST_RUNS = 3;

describe('kairos_attest scoring: propagation and score boost', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function search(query: string): Promise<{ choices: Array<{ uri: string; label: string; chain_label: string; score: number | null; role: string }> }> {
    const args: { query: string; space_id?: string } = { query };
    const spaceId = getTestSpaceId();
    if (spaceId) args.space_id = spaceId;
    const result = await mcpConnection!.client.callTool({ name: 'kairos_search', arguments: args });
    return parseMcpJson(result, 'kairos_search');
  }

  async function searchAllSpaces(query: string): Promise<{ choices: Array<{ uri: string; label: string; chain_label: string; score: number | null; role: string }> }> {
    const result = await mcpConnection!.client.callTool({ name: 'kairos_search', arguments: { query } });
    return parseMcpJson(result, 'kairos_search');
  }

  function getScoreForChain(parsed: { choices: Array<{ chain_label: string | null; label?: string; score: unknown; role: string }> }, chainLabel: string): number | null {
    const matches = parsed.choices.filter((c) => c.role === 'match');
    const effective = (c: (typeof matches)[0]) => (c.chain_label ?? (c as { label?: string }).label ?? '');
    const exact = matches.find((c) => effective(c) === chainLabel);
    const byInclude = exact ?? matches.find((c) => effective(c).includes(chainLabel) || chainLabel.includes(effective(c)));
    const match = byInclude ?? (matches.length === 1 ? matches[0]! : null);
    const raw = match?.score ?? null;
    if (raw == null) return null;
    if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
    if (typeof raw === 'string') { const n = Number(raw); return Number.isNaN(n) ? null : n; }
    if (typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (typeof o.value === 'number' && !Number.isNaN(o.value)) return o.value;
      if (typeof o.score === 'number' && !Number.isNaN(o.score)) return o.score;
    }
    return null;
  }

  /** Mint a 2-step protocol, complete it, return chain label, completion step URI, and chain head URI. */
  async function mintAndComplete(uniqueLabel: string): Promise<{ chainLabel: string; completionStepUri: string; chainHeadUri: string }> {
    const doc = buildProofMarkdown(uniqueLabel, [
      { heading: 'Step One', body: `First for ${uniqueLabel}.`, proofCmd: 'echo step1' },
      { heading: 'Step Two', body: `Second for ${uniqueLabel}.`, proofCmd: 'echo step2' }
    ]);
    const mintArgs: { markdown_doc: string; llm_model_id: string; force_update: boolean; space?: string } = {
      markdown_doc: doc,
      llm_model_id: 'test-attest-scoring',
      force_update: true
    };
    const spaceId = getTestSpaceId();
    if (spaceId) mintArgs.space = spaceId;
    const storeResult = await mcpConnection!.client.callTool({
      name: 'kairos_mint',
      arguments: mintArgs
    });
    const stored = parseMcpJson(storeResult, 'attest-scoring mint');
    expect(stored.status).toBe('stored');
    const items = stored.items as Array<{ uri: string }>;
    const chainHeadUri = items[0]!.uri;
    const completionStepUri = items[1]!.uri;

    const beginResult = await mcpConnection!.client.callTool({
      name: 'kairos_begin',
      arguments: { uri: chainHeadUri }
    });
    const beginPayload = parseMcpJson(beginResult, 'attest-scoring begin');
    const nonce = beginPayload.challenge?.nonce;
    const proofHash = beginPayload.challenge?.proof_hash ?? beginPayload.challenge?.genesis_hash;

    await mcpConnection!.client.callTool({
      name: 'kairos_next',
      arguments: {
        uri: completionStepUri,
        solution: { type: 'shell', nonce, proof_hash: proofHash, shell: { exit_code: 0, stdout: 'step1' } }
      }
    });

    return { chainLabel: uniqueLabel, completionStepUri, chainHeadUri };
  }

  async function attest(uri: string, outcome: 'success' | 'failure', message: string): Promise<void> {
    const result = await mcpConnection!.client.callTool({
      name: 'kairos_attest',
      arguments: { uri, outcome, message }
    });
    parseMcpJson(result, 'kairos_attest');
  }

  test('positive attest: search score increases after MIN_ATTEST_RUNS successes', async () => {
    const ts = Date.now();
    const uniqueLabel = `AttestScoringPositive ${ts}`;
    const { chainLabel, completionStepUri } = await mintAndComplete(uniqueLabel);

    const searchFn = getTestSpaceId() ? searchAllSpaces : search;
    const parsedBefore = await searchFn(uniqueLabel);
    const scoreBefore = getScoreForChain(parsedBefore, chainLabel);
    const matchChoicesBefore = parsedBefore.choices?.filter((c: { role: string }) => c.role === 'match') ?? [];
    if (matchChoicesBefore.length === 0) {
      const msg = `Minted protocol "${chainLabel}" not in search results (0 matches). Ensure dev server is running and mint/search use the same space (e.g. pass space when getTestSpaceId() is set).`;
      throw new Error(msg);
    }
    const matchSummary = matchChoicesBefore.slice(0, 5).map((c: { label?: string; chain_label?: string }) => `${c.chain_label ?? c.label ?? '?'}`);

    for (let i = 0; i < MIN_ATTEST_RUNS; i++) {
      await attest(completionStepUri, 'success', `Run ${i + 1} completed.`);
    }

    const parsedAfter = await searchFn(uniqueLabel);
    const scoreAfter = getScoreForChain(parsedAfter, chainLabel);

    withRawOnFail({ parsedBefore, parsedAfter, chainLabel, scoreBefore, scoreAfter, matchCount: matchChoicesBefore.length, matchSummary }, () => {
      expect(scoreBefore).not.toBeNull();
      expect(scoreAfter).not.toBeNull();
      expect((scoreAfter as number)).toBeGreaterThan(scoreBefore as number);
    });
  }, 45000);

  test('negative attest: search score decreases or stays same after failure', async () => {
    const ts = Date.now();
    const uniqueLabel = `AttestScoringNegative ${ts}`;
    const { chainLabel, completionStepUri } = await mintAndComplete(uniqueLabel);

    const searchFn = getTestSpaceId() ? searchAllSpaces : search;
    for (let i = 0; i < MIN_ATTEST_RUNS; i++) {
      await attest(completionStepUri, 'success', `Warmup ${i + 1}.`);
    }
    const parsedAfterSuccesses = await searchFn(uniqueLabel);
    const scoreAfterSuccesses = getScoreForChain(parsedAfterSuccesses, chainLabel);

    await attest(completionStepUri, 'failure', 'One run failed.');
    const parsedAfterFailure = await searchFn(uniqueLabel);
    const scoreAfterFailure = getScoreForChain(parsedAfterFailure, chainLabel);

    withRawOnFail(
      { chainLabel, scoreAfterSuccesses, scoreAfterFailure, parsedAfterSuccesses, parsedAfterFailure },
      () => {
        expect(scoreAfterSuccesses).not.toBeNull();
        expect(scoreAfterFailure).not.toBeNull();
        expect((scoreAfterFailure as number)).toBeLessThanOrEqual((scoreAfterSuccesses as number) + 0.001);
      }
    );
  }, 45000);

  test('no boost when runs < MIN_ATTEST_RUNS: one success does not change score', async () => {
    const ts = Date.now();
    const uniqueLabel = `AttestScoringNoBoost ${ts}`;
    const { chainLabel, completionStepUri } = await mintAndComplete(uniqueLabel);

    const searchFn = getTestSpaceId() ? searchAllSpaces : search;
    const parsedBefore = await searchFn(uniqueLabel);
    const scoreBefore = getScoreForChain(parsedBefore, chainLabel);

    await attest(completionStepUri, 'success', 'Single run.');

    const parsedAfter = await searchFn(uniqueLabel);
    const scoreAfter = getScoreForChain(parsedAfter, chainLabel);

    withRawOnFail({ parsedBefore, parsedAfter, chainLabel, scoreBefore, scoreAfter }, () => {
      expect(scoreBefore).not.toBeNull();
      expect(scoreAfter).not.toBeNull();
      expect((scoreAfter as number)).toBeCloseTo(scoreBefore as number, 5);
    });
  }, 30000);
});
