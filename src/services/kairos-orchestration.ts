/**
 * Shared search and begin orchestration for MCP tools and HTTP API.
 * Single implementation for routing and step-1 payload so MCP and REST stay aligned.
 */
import type { MemoryQdrantStore } from './memory/store.js';
import type { QdrantService } from './qdrant/service.js';
import type { Memory } from '../types/memory.js';
import { SCORE_THRESHOLD } from '../config.js';
import { resolveFirstStep, resolveChainNextStep, resolveChainFirstStep } from './chain-utils.js';
import { redisCacheService } from './redis-cache.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { buildChallenge } from '../tools/kairos_next-pow-helpers.js';

export const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
export const CREATION_PROTOCOL_URI = `kairos://mem/${CREATION_PROTOCOL_UUID}`;
export const REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';
export const REFINING_PROTOCOL_URI = `kairos://mem/${REFINING_PROTOCOL_UUID}`;

/** One strong match = score >= RELEVANT_SCORE. Used for kairos_run and search refine/create logic. */
export const RELEVANT_SCORE = 0.5;

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

export interface SearchOutput {
  must_obey: true;
  message: string;
  next_action: string;
  choices: UnifiedChoice[];
}

export interface BeginPayload {
  must_obey: true;
  current_step: { uri: string; content: string; mimeType: 'text/markdown' };
  challenge: Record<string, unknown>;
  next_action: string;
  message?: string;
}

interface Candidate {
  memory: Memory;
  score: number;
  uri: string;
  label: string;
  tags: string[];
  total_steps: number;
}

function addCandidate(
  candidateMap: Map<string, { memory: Memory; score: number }>,
  memory: Memory,
  score: number
): void {
  if (!memory) return;
  const key = memory.chain?.id || memory.memory_uuid;
  const existing = candidateMap.get(key);
  const incomingIsHead = memory.chain?.step_index === 1;
  if (!existing) {
    candidateMap.set(key, { memory, score });
    return;
  }
  const existingIsHead = existing.memory.chain?.step_index === 1;
  if (incomingIsHead && !existingIsHead) {
    candidateMap.set(key, { memory, score });
    return;
  }
  if (incomingIsHead === existingIsHead && score > existing.score) {
    candidateMap.set(key, { memory, score });
  }
}

async function searchAndBuildCandidates(
  memoryStore: MemoryQdrantStore,
  query: string,
  enableGroupCollapse: boolean
): Promise<Map<string, { memory: Memory; score: number }>> {
  const candidateMap = new Map<string, { memory: Memory; score: number }>();
  const { memories, scores } = await memoryStore.searchMemories(query, 40, enableGroupCollapse);
  memories.forEach((memory, idx) => addCandidate(candidateMap, memory, scores[idx] ?? 0));
  if (candidateMap.size < 10 && enableGroupCollapse) {
    const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, 80, false);
    moreMemories.forEach((memory, idx) => addCandidate(candidateMap, memory, moreScores[idx] ?? 0));
  }
  return candidateMap;
}

function createResults(headCandidates: Array<{ memory: Memory; score: number }>): Candidate[] {
  return headCandidates
    .map(({ memory, score }) => ({
      memory,
      score,
      uri: `kairos://mem/${memory.memory_uuid}`,
      label: memory.label,
      tags: memory.tags || [],
      total_steps: memory.chain?.step_count || 1
    }))
    .filter(r => r.score >= SCORE_THRESHOLD);
}

async function resolveHead(memory: Memory, qdrantService?: QdrantService): Promise<{ uri: string; label: string }> {
  const head = (await resolveFirstStep(memory, qdrantService)) ?? {
    uri: `kairos://mem/${memory.memory_uuid}`,
    label: memory.label
  };
  return head;
}

const REFINING_NEXT_ACTION = `call kairos_begin with ${REFINING_PROTOCOL_URI} to get step-by-step help turning the user's request into a better search query`;
const CREATE_NEXT_ACTION = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;

async function generateUnifiedOutput(
  results: Candidate[],
  qdrantService?: QdrantService
): Promise<SearchOutput> {
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
      next_action: `call kairos_begin with ${head.uri} to execute this protocol`,
      protocol_version: result.memory.chain?.protocol_version ?? null
    });
  }

  const singleMatchNotRelevant = matchCount === 1 && (choices[0]?.score ?? 0) < RELEVANT_SCORE;
  if (matchCount !== 1 || singleMatchNotRelevant) {
    choices.push(
      {
        uri: REFINING_PROTOCOL_URI,
        label: 'Get help refining your search',
        chain_label: 'Run protocol to turn vague user request into a better kairos_search query',
        score: null,
        role: 'refine',
        tags: ['meta', 'refine'],
        next_action: REFINING_NEXT_ACTION,
        protocol_version: null
      },
      {
        uri: CREATION_PROTOCOL_URI,
        label: 'Create New KAIROS Protocol Chain',
        chain_label: 'Create New KAIROS Protocol Chain',
        score: null,
        role: 'create',
        tags: ['meta', 'creation'],
        next_action: CREATE_NEXT_ACTION,
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

  return {
    must_obey: true,
    message,
    next_action: nextAction,
    choices
  };
}

export interface ExecuteSearchOptions {
  qdrantService?: QdrantService | undefined;
  enableGroupCollapse?: boolean;
}

/**
 * Run search and build unified choices. Does not read or write cache; caller owns caching.
 * Caller must run in the correct space context (e.g. runWithOptionalSpaceAsync for MCP).
 */
export async function executeSearch(
  memoryStore: MemoryQdrantStore,
  query: string,
  options: ExecuteSearchOptions = {}
): Promise<SearchOutput> {
  const enableGroupCollapse = options.enableGroupCollapse ?? true;
  const candidateMap = await searchAndBuildCandidates(memoryStore, query.trim(), enableGroupCollapse);
  let headCandidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  if (headCandidates.length > 10) {
    headCandidates = headCandidates.slice(0, 10);
  }
  const results = headCandidates.length > 0 ? createResults(headCandidates) : [];
  return generateUnifiedOutput(results, options.qdrantService);
}

export interface ExecuteBeginOptions {
  qdrantService?: QdrantService | undefined;
}

async function loadMemoryWithCache(memoryStore: MemoryQdrantStore, uuid: string): Promise<Memory | null> {
  const cached = await redisCacheService.getMemoryResource(uuid);
  if (cached) return cached;
  const memory = await memoryStore.getMemory(uuid);
  if (memory) {
    await redisCacheService.setMemoryResource(memory);
  }
  return memory;
}

function normalizeMemoryUri(value: string): { uuid: string; uri: string } {
  const normalized = (value || '').trim();
  const uuid = normalized.split('/').pop();
  if (!uuid) {
    throw new Error('Invalid kairos://mem URI');
  }
  const uri = normalized.startsWith('kairos://mem/') ? normalized : `kairos://mem/${uuid}`;
  return { uuid, uri };
}

function buildCurrentStep(memory: Memory | null, requestedUri: string) {
  const uri = memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri;
  const content = memory ? extractMemoryBody(memory.text) : '';
  return { uri, content, mimeType: 'text/markdown' as const };
}

function buildBeginPayload(
  memory: Memory | null,
  requestedUri: string,
  nextStepUri: string | null,
  challenge: Record<string, unknown>,
  redirectMessage?: string
): BeginPayload {
  const current_step = buildCurrentStep(memory, requestedUri);
  const currentStepUri = current_step.uri;
  let message: string | undefined = redirectMessage;
  const next_action = nextStepUri
    ? `call kairos_next with ${currentStepUri} and solution matching challenge`
    : `call kairos_attest with ${currentStepUri} and outcome (success or failure) and message to complete the protocol`;
  if (!nextStepUri) {
    message = message
      ? `${message} Single-step protocol. Call kairos_attest to finalize.`
      : 'Single-step protocol. Call kairos_attest to finalize.';
  }
  const payload: BeginPayload = {
    must_obey: true,
    current_step,
    challenge: challenge ?? {},
    next_action
  };
  if (message) payload.message = message;
  return payload;
}

export type RoutingDecision = 'direct_match' | 'refine_ambiguous' | 'refine_no_match' | 'refine_weak_match';

/**
 * Choose which protocol to begin from search choices: one strong match → that URI; else refine.
 */
export function selectRunTarget(choices: UnifiedChoice[]): { uri: string; choice: UnifiedChoice; decision: RoutingDecision } {
  const matches = choices.filter(c => c.role === 'match');
  const fallbackRefine = choices.find(c => c.role === 'refine') ?? {
    uri: REFINING_PROTOCOL_URI,
    label: 'Get help refining your search',
    chain_label: null,
    score: null,
    role: 'refine' as const,
    tags: [] as string[],
    next_action: '',
    protocol_version: null
  };
  if (matches.length === 0) {
    return { uri: fallbackRefine.uri, choice: fallbackRefine, decision: 'refine_no_match' };
  }
  if (matches.length === 1) {
    const score = matches[0]!.score ?? 0;
    if (score >= RELEVANT_SCORE) {
      return { uri: matches[0]!.uri, choice: matches[0]!, decision: 'direct_match' };
    }
    return { uri: fallbackRefine.uri, choice: fallbackRefine, decision: 'refine_weak_match' };
  }
  return { uri: fallbackRefine.uri, choice: fallbackRefine, decision: 'refine_ambiguous' };
}

/**
 * Load step 1 and return begin payload. Uses Redis cache for memory lookup.
 * Caller must run in the correct space context.
 */
export async function executeBegin(
  memoryStore: MemoryQdrantStore,
  uri: string,
  options: ExecuteBeginOptions = {}
): Promise<BeginPayload> {
  const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);
  let memory = await loadMemoryWithCache(memoryStore, uuid);
  let redirectMessage: string | undefined;

  if (memory?.chain && memory.chain.step_index !== 1) {
    const firstStep = await resolveChainFirstStep(memory, options.qdrantService);
    if (firstStep?.uuid) {
      const step1Memory = await loadMemoryWithCache(memoryStore, firstStep.uuid);
      if (step1Memory) {
        memory = step1Memory;
        redirectMessage = 'Redirected to step 1 of this protocol chain.';
      }
    }
  }

  const nextStepInfo = memory
    ? await resolveChainNextStep(memory, options.qdrantService)
    : undefined;
  const nextStepUri = nextStepInfo?.uuid ? `kairos://mem/${nextStepInfo.uuid}` : null;
  const challenge = await buildChallenge(memory, memory?.proof_of_work);
  return buildBeginPayload(memory, requestedUri, nextStepUri, challenge, redirectMessage);
}
