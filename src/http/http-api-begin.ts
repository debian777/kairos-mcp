import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { SCORE_THRESHOLD, KAIROS_ENABLE_GROUP_COLLAPSE } from '../config.js';
import { resolveFirstStep } from '../services/chain-utils.js';
import { redisCacheService } from '../services/redis-cache.js';
import type { Memory } from '../types/memory.js';

const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
const CREATION_PROTOCOL_URI = `kairos://mem/${CREATION_PROTOCOL_UUID}`;
const REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';
const REFINING_PROTOCOL_URI = `kairos://mem/${REFINING_PROTOCOL_UUID}`;
const REFINING_NEXT_ACTION = `call kairos_begin with ${REFINING_PROTOCOL_URI} to get step-by-step help turning the user's request into a better search query`;
const CREATE_NEXT_ACTION = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;

/** Strip built-in protocol URIs and UUIDs from query so they are not used for search or cache key. */
function queryForSearch(query: string): string {
  let q = (query || '').trim();
  for (const token of [REFINING_PROTOCOL_URI, REFINING_PROTOCOL_UUID, CREATION_PROTOCOL_URI, CREATION_PROTOCOL_UUID]) {
    q = q.replace(new RegExp(escapeRegex(token), 'gi'), ' ');
  }
  return q.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface UnifiedChoice {
    uri: string;
    label: string;
    chain_label: string | null;
    score: number | null;
    role: 'match' | 'refine' | 'create';
    tags: string[];
    next_action: string;
    protocol_version: string | null;
}

/**
 * Set up API route for kairos_search (V2 unified response)
 */
export function setupBeginRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
    app.post('/api/kairos_search', async (req, res) => {
        const startTime = Date.now();

        try {
            const { query } = req.body;

            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'query is required and must be a non-empty string'
                });
                return;
            }

            structuredLogger.info(`-> POST /api/kairos_search (query: ${query})`);

            const searchQuery = queryForSearch(query);
            const normalizedQuery = searchQuery.toLowerCase();
            const cacheKey = `begin:v3:${normalizedQuery}:${KAIROS_ENABLE_GROUP_COLLAPSE}`;

            const cachedResult = await redisCacheService.get(cacheKey);
            if (cachedResult) {
                const parsed = JSON.parse(cachedResult);
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    ...parsed,
                    metadata: { cached: true, duration_ms: duration }
                });
            }

            const { memories, scores } = await memoryStore.searchMemories(searchQuery, 40, KAIROS_ENABLE_GROUP_COLLAPSE);
            const candidateMap = new Map<string, { memory: Memory; score: number }>();

            const addCandidate = (memory: Memory, score: number) => {
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
            };

            memories.forEach((memory, idx) => addCandidate(memory, scores[idx] ?? 0));

            if (candidateMap.size < 10 && KAIROS_ENABLE_GROUP_COLLAPSE) {
                const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(searchQuery, 80, false);
                moreMemories.forEach((memory, idx) => addCandidate(memory, moreScores[idx] ?? 0));
            }

            let headCandidates = Array.from(candidateMap.values())
                .sort((a, b) => (b.score - a.score));

            if (headCandidates.length > 10) {
                headCandidates = headCandidates.slice(0, 10);
            }

            const results = headCandidates
                .map(({ memory, score }) => ({
                    memory,
                    score,
                    uri: `kairos://mem/${memory.memory_uuid}`,
                    label: memory.label,
                    tags: memory.tags || [],
                    total_steps: memory.chain?.step_count || 1
                }))
                .filter(r => r.score >= SCORE_THRESHOLD);

            // Build match choices with per-choice next_action
            const choices: UnifiedChoice[] = [];
            const matchCount = results.length;

            for (const result of results) {
                const head = (await resolveFirstStep(result.memory, qdrantService)) ?? {
                    uri: result.uri,
                    label: result.label
                };
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

            // Server-side semantic dispatch: best action at index 0
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

            let message: string;
            const topRole = finalChoices[0]?.role;

            if (hasCreationIntent && offerRefineAndCreate) {
                message = 'Creation intent detected. Follow the top choice to create a new protocol.';
            } else if (matchCount === 0 || topRole === 'refine') {
                message = 'No strong match found. Follow the top choice to refine your search.';
            } else if (matchCount === 1 && topRole === 'match') {
                message = 'Found 1 match.';
            } else if (matchCount >= 1 && topRole === 'match') {
                const confidencePercent = Math.round((finalChoices[0]!.score ?? 0) * 100);
                message = `Found ${matchCount} matches (top confidence: ${confidencePercent}%).`;
            } else {
                message = 'Follow the top choice.';
            }

            const output = {
                must_obey: true,
                message,
                next_action: STRICT_NEXT_ACTION,
                choices: finalChoices
            };

            await redisCacheService.set(cacheKey, JSON.stringify(output), 300);

            const duration = Date.now() - startTime;
            structuredLogger.info(`kairos_search completed in ${duration}ms`);

            res.status(200).json({
                ...output,
                metadata: { duration_ms: duration }
            });
            return;

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`kairos_search failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'SEARCH_FAILED',
                message: error instanceof Error ? error.message : 'Failed to search for chain heads',
                duration_ms: duration
            });
            return;
        }
    });
}
