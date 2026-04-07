/**
 * Output building for search: createResults, resolveHead, generateUnifiedOutput.
 * Extracted to keep `search.ts` under the max-lines limit.
 */

import type { Memory } from '../types/memory.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveAdapterEntry } from '../services/adapter-navigation.js';
import {
  getActivationPatterns,
  getAdapterId,
  getAdapterInfo,
  getAdapterName,
  getAdapterSlugForSearchOutput,
  getLayerCount
} from '../services/memory/memory-accessors.js';
import { buildAdapterUri } from './kairos-uri.js';
import { spaceIdToDisplayName } from '../utils/space-display.js';
import { getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import {
  KAIROS_CREATION_FOOTER_LABEL,
  KAIROS_REFINING_FOOTER_LABEL
} from '../constants/builtin-search-meta.js';

export interface Candidate {
  memory: Memory;
  score: number;
  uri: string;
  label: string;
  tags: string[];
  layer_count: number;
}

export interface UnifiedChoice {
  uri: string;
  label: string;
  adapter_name: string | null;
  score: number | null;
  role: 'match' | 'refine' | 'create';
  tags: string[];
  next_action: string;
  adapter_version: string | null;
  activation_patterns?: string[];
  /** Display name of the space where the adapter is stored (match rows only). */
  space_name: string | null;
  /** Stored adapter routing slug when present; null for refine/create or adapters without slug. */
  slug: string | null;
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
      layer_count: getLayerCount(memory)
    }))
    .filter((result) => result.score >= normalizedThreshold);
}

export async function resolveHead(
  memory: Memory,
  qdrantService?: QdrantService
): Promise<{ uri: string; label: string }> {
  const head = (await resolveAdapterEntry(memory, qdrantService)) ?? {
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
  /** Stored adapter version for refine protocol (from Qdrant), when resolvable. */
  refiningProtocolVersion?: string | null;
  /** Stored adapter version for create protocol (from Qdrant), when resolvable. */
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
  const spaceNamesById = getSpaceContextFromStorage().spaceNamesById;

  for (const result of results) {
    const head = await resolveHead(result.memory, qdrantService);
    const sid = result.memory.space_id ?? KAIROS_APP_SPACE_ID;
    const slug = getAdapterSlugForSearchOutput(result.memory);
    choices.push({
      uri: head.uri,
      label: head.label || result.label,
      adapter_name: getAdapterName(result.memory) || null,
      score: result.score,
      role: 'match',
      tags: result.tags,
      next_action: `call forward with ${head.uri} and no solution to start this adapter`,
      adapter_version: getAdapterInfo(result.memory)?.protocol_version ?? null,
      activation_patterns: getActivationPatterns(result.memory),
      space_name: spaceIdToDisplayName(sid, spaceNamesById),
      slug
    });
  }

  const includeMetaFooter = true;
  if (includeMetaFooter) {
    choices.push(
      {
        uri: refiningUri,
        label: KAIROS_REFINING_FOOTER_LABEL,
        adapter_name: KAIROS_REFINING_FOOTER_LABEL,
        score: null,
        role: 'refine',
        tags: ['meta', 'refine'],
        next_action: refiningNextAction,
        adapter_version: refiningProtocolVersion,
        space_name: null,
        slug: null
      },
      {
        uri: createUri,
        label: KAIROS_CREATION_FOOTER_LABEL,
        adapter_name: KAIROS_CREATION_FOOTER_LABEL,
        score: null,
        role: 'create',
        tags: ['meta', 'creation'],
        next_action: createNextAction,
        adapter_version: createProtocolVersion,
        space_name: null,
        slug: null
      }
    );
  }

  let message: string;
  let nextAction: string;
  if (matchCount === 0) {
    message = 'No existing adapter/protocol matched your query. Refine your search or create a new one.';
    nextAction = "Pick one choice and follow that choice's next_action.";
  } else if (matchCount === 1 && includeMetaFooter) {
    message = 'Found 1 match. You can run it, refine your search, or create a new adapter/protocol.';
    nextAction = "Pick one choice and follow that choice's next_action.";
  } else if (matchCount === 1) {
    message = 'Found 1 match.';
    nextAction = "Follow the choice's next_action.";
  } else {
    const topMatch = choices[0]!;
    const confidencePercent = Math.round((topMatch.score || 0) * 100);
    message = `Found ${matchCount} matches (top confidence: ${confidencePercent}%). Choose one, refine your search, or create a new adapter/protocol.`;
    nextAction = "Pick one choice and follow that choice's next_action.";
  }
  return { must_obey: true, message, next_action: nextAction, choices };
}
