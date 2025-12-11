import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { SCORE_THRESHOLD } from '../config.js';
import { resolveChainFirstStep } from '../services/chain-utils.js';
import { redisCacheService } from '../services/redis-cache.js';
import type { Memory } from '../types/memory.js';

/**
 * Set up API route for kairos_search
 * @param app Express application instance
 * @param memoryStore Memory store instance
 * @param qdrantService Qdrant service instance
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

            structuredLogger.info(`→ POST /api/kairos_search (query: ${query})`);

            // Replicate kairos_begin logic
            const normalizedQuery = query.trim().toLowerCase();
            const parseEnvBool = (name: string, defaultVal: boolean) => {
                const v = process.env[name];
                if (v === undefined) return defaultVal;
                const low = String(v).toLowerCase();
                return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
            };
            const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
            const cacheKey = `begin:v2:${normalizedQuery}:${enableGroupCollapse}`;

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

            if (headCandidates.length === 0) {
                const output = {
                    must_obey: false,
                    protocol_status: 'no_protocol',
                    message: "I couldn't find any relevant protocol for your request.",
                    suggestion: 'Would you like to create a new one?'
                };
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    ...output,
                    metadata: { duration_ms: duration }
                });
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

            if (results.length === 0) {
                const output = {
                    must_obey: false,
                    protocol_status: 'no_protocol',
                    message: "I couldn't find any relevant protocol for your request.",
                    suggestion: 'Would you like to create a new one?'
                };
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    ...output,
                    metadata: { duration_ms: duration }
                });
            }

            const perfectMatches = results.filter(r => r.score >= 1.0);
            let output: any;

            if (perfectMatches.length === 1) {
                const match = perfectMatches[0]!;
                const headStep = await resolveChainFirstStep(match.memory, qdrantService);
                const headUri = headStep ? `kairos://mem/${headStep.uuid}` : match.uri;
                output = {
                    must_obey: true,
                    start_here: headUri,
                    chain_label: match.memory.chain?.label || null,
                    total_steps: match.total_steps,
                    protocol_status: 'initiated'
                };
            } else if (perfectMatches.length > 1) {
                const resolvedHeads = await Promise.all(perfectMatches.map(async (match) => {
                    const headStep = await resolveChainFirstStep(match.memory, qdrantService);
                    const headUri = headStep ? `kairos://mem/${headStep.uuid}` : match.uri;
                    const headLabel = headStep?.label || match.label;
                    return {
                        uri: headUri,
                        label: headLabel,
                        chain_label: match.memory.chain?.label || null,
                        tags: match.tags
                    };
                }));
                output = {
                    must_obey: false,
                    multiple_perfect_matches: perfectMatches.length,
                    message: `Great! We have ${perfectMatches.length} canonical protocols that perfectly match your request. Choose one protocol by calling kairos_begin with its URI from the choices array. Once committed, must_obey: true applies and execution becomes mandatory.`,
                    next_action: 'call kairos_begin with choice.uri to commit to a protocol',
                    choices: resolvedHeads,
                    protocol_status: 'initiated'
                };
            } else {
                const topResult = results[0]!;
                const headStep = await resolveChainFirstStep(topResult.memory, qdrantService);
                const headUri = headStep ? `kairos://mem/${headStep.uuid}` : topResult.uri;
                const headLabel = headStep?.label || topResult.label;
                const confidencePercent = Math.round((topResult.score || 0) * 100);
                output = {
                    must_obey: false,
                    protocol_status: 'partial_match',
                    best_match: {
                        uri: headUri,
                        label: headLabel,
                        chain_label: topResult.memory.chain?.label || null,
                        score: topResult.score || 0,
                        total_steps: topResult.total_steps
                    },
                    message: `I found a relevant protocol (confidence: ${confidencePercent}%). Shall I proceed?`,
                    hint: 'Or would you like to create a new canonical one?'
                };
            }

            await redisCacheService.set(cacheKey, JSON.stringify(output), 300);

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ kairos_begin completed in ${duration}ms`);

            res.status(200).json({
                ...output,
                metadata: { duration_ms: duration }
            });
            return;

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`✗ kairos_begin failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'BEGIN_FAILED',
                message: error instanceof Error ? error.message : 'Failed to search for chain heads',
                duration_ms: duration
            });
            return;
        }
    });
}

