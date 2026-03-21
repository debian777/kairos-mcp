/**
 * Output building for search: createResults, resolveHead, generateUnifiedOutput.
 * Extracted to keep `search.ts` under the max-lines limit.
 */

import type { Memory } from '../types/memory.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveFirstStep } from '../services/chain-utils.js';

export interface Candidate {
  memory: Memory;
  score: number;
  uri: string;
  label: string;
  tags: string[];
  total_steps: number;
}

export interface UnifiedChoice {
  uri: string;
  label: string;
  chain_label: string | null;
  score: number | null;
  role: 'match' | 'refine' | 'create';
  tags: string[];
  next_action: string;
  protocol_version: string | null;
}

export function createResults(
  headCandidates: Array<{ memory: Memory; score: number }>,
  scoreThreshold: number
): Candidate[] {
  return headCandidates
    .map(({ memory, score }) => ({
      memory,
      score,
      uri: `kairos://mem/${memory.memory_uuid}`,
      label: memory.label,
      tags: memory.tags || [],
      total_steps: memory.chain?.step_count || 1
    }))
    .filter((result) => result.score >= scoreThreshold);
}

export async function resolveHead(
  memory: Memory,
  qdrantService?: QdrantService
): Promise<{ uri: string; label: string }> {
  const head = (await resolveFirstStep(memory, qdrantService)) ?? {
    uri: `kairos://mem/${memory.memory_uuid}`,
    label: memory.label
  };
  return head;
}

export interface GenerateUnifiedOutputOpts {
  refiningUri: string;
  refiningNextAction: string;
  createUri: string;
  createNextAction: string;
}

export async function generateUnifiedOutput(
  results: Candidate[],
  qdrantService: QdrantService | undefined,
  opts: GenerateUnifiedOutputOpts
): Promise<{ must_obey: boolean; message: string; next_action: string; choices: UnifiedChoice[] }> {
  const { refiningUri, refiningNextAction, createUri, createNextAction } = opts;
  const choices: UnifiedChoice[] = [];
  const matchCount = results.length;

  for (const result of results) {
    const head = await resolveHead(result.memory, qdrantService);
    choices.push({
      uri: head.uri,
      label: head.label || result.label,
      chain_label: result.memory.chain?.label || null,
      score: result.score,
      role: 'match',
      tags: result.tags,
      next_action: `call forward with ${head.uri} to execute this protocol`,
      protocol_version: result.memory.chain?.protocol_version ?? null
    });
  }

  const RELEVANT_SCORE = 0.5;
  const singleMatchNotRelevant = matchCount === 1 && (choices[0]?.score ?? 0) < RELEVANT_SCORE;
  if (matchCount !== 1 || singleMatchNotRelevant) {
    choices.push(
      {
        uri: refiningUri,
        label: 'Get help refining your search',
        chain_label: 'Run protocol to turn vague user request into a better search query',
        score: null,
        role: 'refine',
        tags: ['meta', 'refine'],
        next_action: refiningNextAction,
        protocol_version: null
      },
      {
        uri: createUri,
        label: 'Create New KAIROS Protocol Chain',
        chain_label: 'Create New KAIROS Protocol Chain',
        score: null,
        role: 'create',
        tags: ['meta', 'creation'],
        next_action: createNextAction,
        protocol_version: null
      }
    );
  }

  let message: string;
  let nextAction: string;
  if (matchCount === 0) {
    message = 'No existing protocol matched your query. Refine your search or create a new one.';
    nextAction = "Pick one choice and follow that choice's next_action.";
  } else if (matchCount === 1) {
    message = 'Found 1 match.';
    nextAction = "Follow the choice's next_action.";
  } else {
    const topMatch = choices[0]!;
    const confidencePercent = Math.round((topMatch.score || 0) * 100);
    message = `Found ${matchCount} matches (top confidence: ${confidencePercent}%). Choose one, refine your search, or create a new protocol.`;
    nextAction = "Pick one choice and follow that choice's next_action.";
  }
  return { must_obey: true, message, next_action: nextAction, choices };
}
