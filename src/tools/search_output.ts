/**
 * Output building for search: createResults, resolveHead, generateUnifiedOutput.
 * Extracted to keep `search.ts` under the max-lines limit.
 */

import type { Memory } from '../types/memory.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveFirstStep } from '../services/chain-utils.js';
import { getActivationPatterns, getAdapterId, getAdapterInfo, getAdapterName, getLayerCount } from '../services/memory/memory-accessors.js';
import { buildAdapterUri } from './kairos-uri.js';

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
  activation_patterns?: string[];
}

const PUBLIC_SCORE_PIVOT = 0.5;

export function normalizePublicSearchScore(score: number | null | undefined): number {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return 0;
  }
  return score / (score + PUBLIC_SCORE_PIVOT);
}

export function createResults(
  headCandidates: Array<{ memory: Memory; score: number }>,
  scoreThreshold: number
): Candidate[] {
  const normalizedThreshold = normalizePublicSearchScore(scoreThreshold);
  return headCandidates
    .map(({ memory, score }) => ({
      memory,
      score: normalizePublicSearchScore(score),
      uri: buildAdapterUri(getAdapterId(memory)),
      label: memory.label,
      tags: memory.tags || [],
      total_steps: getLayerCount(memory)
    }))
    .filter((result) => result.score >= normalizedThreshold);
}

export async function resolveHead(
  memory: Memory,
  qdrantService?: QdrantService
): Promise<{ uri: string; label: string }> {
  const head = (await resolveFirstStep(memory, qdrantService)) ?? {
    uri: buildAdapterUri(getAdapterId(memory)),
    label: memory.label
  };
  return head;
}

export interface GenerateUnifiedOutputOpts {
  refiningUri: string;
  refiningNextAction: string;
  createUri: string;
  createNextAction: string;
  /** Stored chain version for refine protocol (from Qdrant), when resolvable. */
  refiningProtocolVersion?: string | null;
  /** Stored chain version for create protocol (from Qdrant), when resolvable. */
  createProtocolVersion?: string | null;
}

export async function generateUnifiedOutput(
  results: Candidate[],
  qdrantService: QdrantService | undefined,
  opts: GenerateUnifiedOutputOpts
): Promise<{ must_obey: boolean; message: string; next_action: string; choices: UnifiedChoice[] }> {
  const {
    refiningUri,
    refiningNextAction,
    createUri,
    createNextAction,
    refiningProtocolVersion = null,
    createProtocolVersion = null
  } = opts;
  const choices: UnifiedChoice[] = [];
  const matchCount = results.length;

  for (const result of results) {
    const head = await resolveHead(result.memory, qdrantService);
    choices.push({
      uri: head.uri,
      label: head.label || result.label,
      chain_label: getAdapterName(result.memory) || null,
      score: result.score,
      role: 'match',
      tags: result.tags,
      next_action: `call forward with ${head.uri} to execute this adapter`,
      protocol_version: getAdapterInfo(result.memory)?.protocol_version ?? null,
      activation_patterns: getActivationPatterns(result.memory)
    });
  }

  const RELEVANT_SCORE = normalizePublicSearchScore(0.5);
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
        protocol_version: refiningProtocolVersion
      },
      {
        uri: createUri,
        label: 'Create New KAIROS adapter',
        chain_label: 'Create New KAIROS adapter',
        score: null,
        role: 'create',
        tags: ['meta', 'creation'],
        next_action: createNextAction,
        protocol_version: createProtocolVersion
      }
    );
  }

  let message: string;
  let nextAction: string;
  if (matchCount === 0) {
    message = 'No existing adapter matched your query. Refine your search or create a new one.';
    nextAction = "Pick one choice and follow that choice's next_action.";
  } else if (matchCount === 1) {
    message = 'Found 1 match.';
    nextAction = "Follow the choice's next_action.";
  } else {
    const topMatch = choices[0]!;
    const confidencePercent = Math.round((topMatch.score || 0) * 100);
    message = `Found ${matchCount} matches (top confidence: ${confidencePercent}%). Choose one, refine your search, or create a new adapter.`;
    nextAction = "Pick one choice and follow that choice's next_action.";
  }
  return { must_obey: true, message, next_action: nextAction, choices };
}
