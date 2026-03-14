import type { QdrantService } from '../services/qdrant/service.js';
import { resolveFirstStep } from '../services/chain-utils.js';
import type { Memory } from '../types/memory.js';

const CREATION_PROTOCOL_URI = 'kairos://mem/00000000-0000-0000-0000-000000002001';
const REFINING_PROTOCOL_URI = 'kairos://mem/00000000-0000-0000-0000-000000002002';
const REFINING_NEXT_ACTION = `call kairos_begin with ${REFINING_PROTOCOL_URI} to get step-by-step help turning the user's request into a better search query`;
const CREATE_NEXT_ACTION = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;

/** Detect explicit creation intent (create/mint/build new protocol/workflow/chain). */
const CREATION_INTENT_REGEX = /\b(create|mint|build|new)\b.*\b(protocol|workflow|chain)\b/i;
const RELEVANT_SCORE = 0.5;
const STRICT_NEXT_ACTION = "You MUST pick the top choice (index 0) and follow that choice's next_action.";

export interface SearchCandidate {
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

const refineChoice: UnifiedChoice = {
  uri: REFINING_PROTOCOL_URI,
  label: 'Get help refining your search',
  chain_label: 'Run protocol to turn vague user request into a better kairos_search query',
  score: null,
  role: 'refine',
  tags: ['meta', 'refine'],
  next_action: REFINING_NEXT_ACTION,
  protocol_version: null
};

const createChoice: UnifiedChoice = {
  uri: CREATION_PROTOCOL_URI,
  label: 'Create New KAIROS Protocol Chain',
  chain_label: 'Create New KAIROS Protocol Chain',
  score: null,
  role: 'create',
  tags: ['meta', 'creation'],
  next_action: CREATE_NEXT_ACTION,
  protocol_version: null
};

async function resolveHead(memory: Memory, qdrantService?: QdrantService): Promise<{ uri: string; label: string }> {
  const head = (await resolveFirstStep(memory, qdrantService)) ?? {
    uri: `kairos://mem/${memory.memory_uuid}`,
    label: memory.label
  };
  return head;
}

export async function generateUnifiedOutput(
  results: SearchCandidate[],
  normalizedQuery: string,
  qdrantService?: QdrantService
): Promise<{ must_obey: true; message: string; next_action: string; choices: UnifiedChoice[] }> {
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
  const offerRefineAndCreate = matchCount !== 1 || singleMatchNotRelevant;
  const hasCreationIntent = CREATION_INTENT_REGEX.test(normalizedQuery);
  const topScore = choices[0]?.score ?? 0;
  const hasStrongTopMatch = matchCount >= 1 && topScore >= RELEVANT_SCORE;

  let finalChoices: UnifiedChoice[];
  if (!offerRefineAndCreate) {
    finalChoices = choices;
  } else if (hasCreationIntent) {
    finalChoices = [createChoice, ...choices, refineChoice];
  } else if (matchCount === 0) {
    finalChoices = [refineChoice, createChoice];
  } else if (!hasStrongTopMatch) {
    finalChoices = [refineChoice, ...choices, createChoice];
  } else {
    finalChoices = [...choices, refineChoice, createChoice];
  }

  const topRole = finalChoices[0]?.role;
  let message: string;
  if (hasCreationIntent && offerRefineAndCreate) {
    message = 'Creation intent detected. Follow the top choice to create a new protocol.';
  } else if (matchCount === 0 || topRole === 'refine') {
    message = 'No strong match found. Follow the top choice to refine your search.';
  } else if (matchCount === 1 && topRole === 'match') {
    message = 'Found 1 match.';
  } else if (matchCount >= 1 && topRole === 'match') {
    message = `Found ${matchCount} matches (top confidence: ${Math.round((finalChoices[0]!.score ?? 0) * 100)}%).`;
  } else {
    message = 'Follow the top choice.';
  }

  return { must_obey: true, message, next_action: STRICT_NEXT_ACTION, choices: finalChoices };
}
