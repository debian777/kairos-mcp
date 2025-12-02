import type { Memory } from '../types/memory.js';
import { resolveHead } from './kairos_begin-helpers.js';
import type { QdrantService } from '../services/qdrant/service.js';

interface Candidate {
  memory: Memory;
  score: number;
  uri: string;
  label: string;
  tags: string[];
  total_steps: number;
}

/**
 * Generates output for single perfect match (obedience mode)
 */
export async function generateSinglePerfectMatchOutput(
  match: Candidate,
  qdrantService?: QdrantService
): Promise<any> {
  const head = await resolveHead(match.memory, qdrantService);
  return {
    must_obey: true,
    start_here: head.uri,
    chain_label: match.memory.chain?.label || null,
    total_steps: match.total_steps,
    protocol_status: 'initiated'
  };
}

/**
 * Generates output for multiple perfect matches (choice mode)
 */
export async function generateMultiplePerfectMatchesOutput(
  perfectMatches: Candidate[],
  qdrantService?: QdrantService
): Promise<any> {
  const resolvedHeads = await Promise.all(perfectMatches.map(async (match) => {
    const head = await resolveHead(match.memory, qdrantService);
    return {
      uri: head.uri,
      label: head.label || match.label,
      chain_label: match.memory.chain?.label || null,
      tags: match.tags
    };
  }));
  return {
    must_obey: false,
    multiple_perfect_matches: perfectMatches.length,
    message: `Great! We have ${perfectMatches.length} canonical protocols that perfectly match your request. Which one would you like to use?`,
    choices: resolvedHeads,
    protocol_status: 'initiated'
  };
}

/**
 * Generates output for partial match (best effort mode)
 */
export async function generatePartialMatchOutput(
  topResult: Candidate,
  qdrantService?: QdrantService
): Promise<any> {
  const head = await resolveHead(topResult.memory, qdrantService);
  const confidencePercent = Math.round((topResult.score || 0) * 100);
  return {
    must_obey: false,
    protocol_status: 'partial_match',
    best_match: {
      uri: head.uri,
      label: head.label || topResult.label,
      chain_label: topResult.memory.chain?.label || null,
      score: topResult.score || 0,
      total_steps: topResult.total_steps
    },
    message: `I found a relevant protocol (confidence: ${confidencePercent}%). Shall I proceed?`,
    hint: 'Or would you like to create a new canonical one?'
  };
}

/**
 * Generates output for no results (no protocol mode)
 */
export function generateNoResultsOutput(): any {
  return {
    must_obey: false,
    protocol_status: 'no_protocol',
    message: "I couldn't find any relevant protocol for your request.",
    suggestion: "Would you like to create a new one?"
  };
}


