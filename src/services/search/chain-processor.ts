/**
 * Semantic Search Service for KAIROS Stage 2 - Chain Processor
 *
 * Handles memory chain detection and collapsing logic
 */

import type { SemanticResult } from './types.js';
import type { MemoryResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Chain Processor handles memory chain detection and collapsing operations
 */
export class ChainProcessor {
    /**
     * Detect memory chain groups in search results
     * Groups items that belong to the same chain (formerly "protocol")
     * using domain, type, and task as stable grouping keys.
     */
    detectMemoryChainGroups(results: SemanticResult[]): Map<string, SemanticResult[]> {
        const groups = new Map<string, SemanticResult[]>();

        for (const result of results) {
            // Chain membership is indicated by presence of chain metadata on the item
            if (!result.memory.protocol) {
                // Not a protocol item, will be handled separately
                continue;
            }

            // Create unique key for grouping (use task for chain grouping)
            const key = `${result.memory.domain}:${result.memory.type}:${result.memory.task}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key)!.push(result);
        }

        return groups;
    }

    /**
     * Collapse memory chain groups into a single entry pointing to step 1.
     * When 2+ chain steps detected with same key, collapse to the first step.
     */
    collapseMemoryChainGroups(
        results: SemanticResult[],
        groups: Map<string, SemanticResult[]>
    ): SemanticResult[] {
        const collapsed: SemanticResult[] = [];
        const processedMemoryIds = new Set<string>();

        // Process protocol groups
        for (const items of groups.values()) {
            if (items.length === 0) continue; // Safety check

            const firstItem = items[0];
            if (!firstItem) continue; // Extra safety

            if (items.length < 2) {
                // Only one step, return as-is (will fix URI later)
                collapsed.push(firstItem);
                processedMemoryIds.add(firstItem.memory.id);
                continue;
            }

            // Multiple steps detected - return pointer to STEP 1
            // Ensures sequential execution for AI agents
            const step1 = items.find(i => i.memory.protocol?.step === 1) || firstItem;
            const first = step1.memory;
            const maxScore = Math.max(...items.map(i => i.combinedScore));
            const allTags = [...new Set(items.flatMap(i => i.memory.tags))];

            // Normalize chain fields with safe guards (chain meta is optional in types)
            const protocol = first.protocol;
            const protocolTotal = protocol?.total ?? items.length;
            const protocolEnforcement = protocol?.enforcement ?? 'sequential';
            const protocolSkipAllowed = protocol?.skip_allowed ?? false;

            // Point AI to step 1 with guidance to apply sequentially
            const step1Memory: MemoryResult = {
                ...first,
                id: first.id, // Preserve the UUID from unified store protocol
                tags: allTags,
                description: `Start ${protocolTotal}-step ${first.task} memory chain (Step 1)`,
                content: `🎯 AI WORKFLOW GUIDANCE:\n\n` +
                    `This is a ${protocolTotal}-step ${protocolEnforcement === 'sequential' ? 'sequential' : 'flexible'} memory chain for ${first.task}.\n\n` +
                    `**YOUR TASK NOW:**\n` +
                    `1. READ the current step instructions below\n` +
                    `2. APPLY the step to your current work\n` +
                    `3. CHECK compliance with success criteria\n` +
                    `4. MOVE to next step only when current step is complete\n\n` +
                    `**ENFORCEMENT:** ${protocolEnforcement}\n` +
                    `**SKIPPING ALLOWED:** ${protocolSkipAllowed ? 'Yes' : 'No - ALL steps mandatory'}\n\n` +
                    `---\n\n` +
                    `${first.content}`,
                relevance: maxScore,
                protocol: {
                    step: 1,  // IMPORTANT: Set to 1, not 0, so URI builder generates /step/1 instead of /index
                    total: protocolTotal,
                    enforcement: protocolEnforcement,
                    skip_allowed: protocolSkipAllowed,
                },
            };

            // DEBUG: Log UUID preservation
            logger.info(`DEBUG: Memory chain collapsing - first.id: ${first.id}, step1Memory.id: ${step1Memory.id}`);

            collapsed.push({
                memory: step1Memory,
                semanticScore: maxScore,
                contextScore: step1?.contextScore ?? 0,
                combinedScore: maxScore,
                explanation: `Start ${protocolTotal}-step ${first.task} memory chain at Step 1`,
                reasoning: {
                    semantic: `Detected ${items.length} chain steps - directing to Step 1 for sequential execution`,
                    context: step1?.reasoning?.context ?? '',
                    overall: `Memory Chain: ${first.task} - Begin with Step 1 of ${protocolTotal}`,
                },
            });

            // Mark all items as processed
            items.forEach(item => processedMemoryIds.add(item.memory.id));
        }

        // Add non-protocol items
        const nonProtocolItems = results.filter(r =>
            !r.memory.protocol && !processedMemoryIds.has(r.memory.id)
        );

        return [...collapsed, ...nonProtocolItems];
    }

    /**
     * Collapse memory chain entries from external callers.
     * Accepts already-constructed SemanticResult[] and returns collapsed results.
     */
    collapseMemoryChainResults(results: SemanticResult[]): SemanticResult[] {
        const groups = this.detectMemoryChainGroups(results);
        return this.collapseMemoryChainGroups(results, groups);
    }

    /**
     * Detect protocol groups and return collapsed entries
     * Groups protocol steps by task and creates index entries
     */
    detectAndCollapseProtocols(memories: MemoryResult[]): MemoryResult[] {
        logger.info(`Analyzing ${memories.length} memories for protocols`);
        const protocolGroups = new Map<string, MemoryResult[]>();

        // Group memories by task (protocol identifier)
        for (const memory of memories) {
            if (memory.protocol) {
                const groupKey = `${memory.domain}|${memory.task}`;
                if (!protocolGroups.has(groupKey)) {
                    protocolGroups.set(groupKey, []);
                }
                protocolGroups.get(groupKey)!.push(memory);
            }
        }

        logger.info(`Found ${protocolGroups.size} protocol groups`);

        // Create collapsed protocol index entries
        const collapsedMemories: MemoryResult[] = [];
        for (const [groupKey, groupMemories] of protocolGroups.entries()) {
            if (groupMemories.length > 1) {  // Only collapse if multiple steps found
                const [domain, protocolName] = groupKey.split('|');
                const firstStep = groupMemories[0];
                const protocol = firstStep?.protocol;

                if (!domain || !protocolName || !protocol) {
                    logger.warn(`Skipping invalid protocol group ${groupKey}`);
                    continue;
                }

                logger.info(`Collapsing protocol group ${groupKey} with ${groupMemories.length} steps`);

                collapsedMemories.push({
                    id: `protocol-${domain}-${protocolName}`,
                    domain: domain,
                    task: protocolName,
                    type: 'rule',
                    tags: [domain, 'protocol', protocolName],
                    description: `${protocol.total || groupMemories.length}-step protocol for ${protocolName}`,
                    content: `Protocol: ${protocolName}\nTotal steps: ${protocol.total || groupMemories.length}\nEnforcement: ${protocol.enforcement || 'sequential'}`,
                    relevance: Math.max(...groupMemories.map(m => m.relevance)),
                    created_at: new Date().toISOString(),
                    confidence: Math.max(...groupMemories.map(m => m.confidence)),
                    protocol: {
                        step: 0,  // Index entry
                        total: protocol.total || groupMemories.length,
                        enforcement: protocol.enforcement || 'sequential',
                        skip_allowed: protocol.skip_allowed || false
                    }
                });
            }
        }

        logger.info(`Created ${collapsedMemories.length} collapsed protocol entries`);
        return collapsedMemories;
    }
}