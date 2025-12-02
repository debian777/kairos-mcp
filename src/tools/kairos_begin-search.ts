import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { addCandidate } from './kairos_begin-helpers.js';

/**
 * Performs search and builds candidate map, preferring chain heads
 */
export async function searchAndBuildCandidates(
  memoryStore: MemoryQdrantStore,
  query: string,
  normalizedQuery: string,
  enableGroupCollapse: boolean
): Promise<Map<string, { memory: Memory; score: number }>> {
  const candidateMap = new Map<string, { memory: Memory; score: number }>();

  // Initial search
  const { memories, scores } = await memoryStore.searchMemories(query, 40, enableGroupCollapse);
  memories.forEach((memory, idx) => addCandidate(candidateMap, memory, scores[idx] ?? 0));

  if (normalizedQuery === 'ai coding rules') {
    structuredLogger.warn(`[begin-debug] initial results=${memories.length} uniqueChains=${candidateMap.size} enableCollapse=${enableGroupCollapse}`);
  }

  // If not enough unique chains, try without collapse to find more
  if (candidateMap.size < 10 && enableGroupCollapse) {
    const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, 80, false);
    moreMemories.forEach((memory, idx) => addCandidate(candidateMap, memory, moreScores[idx] ?? 0));
    if (normalizedQuery === 'ai coding rules') {
      structuredLogger.warn(`[begin-debug] after fallback uniqueChains=${candidateMap.size}`);
    }
  }

  return candidateMap;
}


