import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { SCORE_THRESHOLD } from '../config.js';
import { resolveFirstStep } from '../services/chain-utils.js';
import { redisCacheService } from '../services/redis-cache.js';
import type { Memory } from '../types/memory.js';

const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
const CREATION_PROTOCOL_URI = `kairos://mem/${CREATION_PROTOCOL_UUID}`;
const REFINE_SEARCH_URI = 'kairos://action/refine-search';
const REFINE_NEXT_ACTION = 'call kairos_search with more words or details to narrow results';
const CREATE_NEXT_ACTION = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;

interface UnifiedChoice {
    uri: string;
    label: string;
    chain_label: string | null;
    score: number | null;
    role: 'match' | 'refine' | 'create';
    tags: string[];
    next_action: string;
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

            const normalizedQuery = query.trim().toLowerCase();
            const parseEnvBool = (name: string, defaultVal: boolean) => {
                const v = process.env[name];
                if (v === undefined) return defaultVal;
                const low = String(v).toLowerCase();
                return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
            };
            const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
            const cacheKey = `begin:v3:${normalizedQuery}:${enableGroupCollapse}`;

            const cachedResult = await redisCacheService.get(cacheKey);
            if (cachedResult) {
                const parsed = JSON.parse(cachedResult);
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    ...parsed,
                    metadata: { cached: true, duration_ms: duration }
                });
            }

            const { memories, scores } = await memoryStore.searchMemories(query, 40, enableGroupCollapse);
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

            if (candidateMap.size < 10 && enableGroupCollapse) {
                const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, 80, false);
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

            // Build unified choices: matches with per-choice next_action, then refine (if 0 or >1 matches), then create (if 0 or >1)
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
                    next_action: `call kairos_begin with ${head.uri} to execute this protocol`
                });
            }

            if (matchCount === 0) {
                choices.push({
                    uri: REFINE_SEARCH_URI,
                    label: 'Refine search',
                    chain_label: 'Refine your query and search again',
                    score: null,
                    role: 'refine',
                    tags: ['meta', 'refine'],
                    next_action: REFINE_NEXT_ACTION
                });
                choices.push({
                    uri: CREATION_PROTOCOL_URI,
                    label: 'Create New KAIROS Protocol Chain',
                    chain_label: 'Create New KAIROS Protocol Chain',
                    score: null,
                    role: 'create',
                    tags: ['meta', 'creation'],
                    next_action: CREATE_NEXT_ACTION
                });
            } else if (matchCount > 1) {
                choices.push({
                    uri: REFINE_SEARCH_URI,
                    label: 'Refine search',
                    chain_label: 'Refine your query and search again',
                    score: null,
                    role: 'refine',
                    tags: ['meta', 'refine'],
                    next_action: REFINE_NEXT_ACTION
                });
                choices.push({
                    uri: CREATION_PROTOCOL_URI,
                    label: 'Create New KAIROS Protocol Chain',
                    chain_label: 'Create New KAIROS Protocol Chain',
                    score: null,
                    role: 'create',
                    tags: ['meta', 'creation'],
                    next_action: CREATE_NEXT_ACTION
                });
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

            const output = {
                must_obey: true,
                message,
                next_action: nextAction,
                choices
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
