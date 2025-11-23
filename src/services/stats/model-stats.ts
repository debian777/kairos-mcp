/**
 * ModelStatsService (orchestrator)
 *
 * Manages model performance statistics and quality scoring.
 * Delegates to modular submodules:
 * - stats-types.ts
 * - stats-scoring.ts
 * - stats-bonuses.ts
 * - stats-healer.ts
 * - stats-protocol.ts
 *
 * The orchestrator keeps minimal state and coordinates persistence via redis.
 */

import { logger } from '../../utils/logger.js';
import { redisService } from '../redis.js';
import type { QualityMetrics } from '../../types/index.js';
import type { QualityScore, GameLeaderboard, ModelStats, RecentDiscovery } from './types.js';
import {
  agentContributions,
  agentImplementationBonus,
  agentRareSuccesses,
  agentQualityScore
} from '../metrics/agent-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

// Leaderboard helper functions (inlined - leaderboard.ts removed in Phase 4)
async function loadLeaderboard(): Promise<GameLeaderboard | null> {
    return await redisService.getJson<GameLeaderboard>('stats:leaderboard');
}

async function saveLeaderboard(leaderboard: GameLeaderboard): Promise<void> {
    await redisService.setJson('stats:leaderboard', leaderboard);
}

function ensureLeaderboardShape(leaderboard?: Partial<GameLeaderboard>): GameLeaderboard {
    return {
        totalGems: (leaderboard && leaderboard.totalGems) || {},
        legendaryGems: (leaderboard && leaderboard.legendaryGems) || {},
        recentDiscoveries: (leaderboard && leaderboard.recentDiscoveries) || [],
        implementationBonuses: (leaderboard && leaderboard.implementationBonuses) || {},
        healerBonuses: (leaderboard && leaderboard.healerBonuses) || {}
    };
}

function addRecentDiscovery(leaderboard: GameLeaderboard, discovery: RecentDiscovery): void {
    leaderboard.recentDiscoveries.unshift(discovery);
    leaderboard.recentDiscoveries = leaderboard.recentDiscoveries.slice(0, 20);
    logger.info(`Added recent discovery by ${discovery.agent} (${discovery.score}pts)`);
}

async function updateImplementationBonusHelper(leaderboard: GameLeaderboard, llm_model_id: string, bonusPoints: number): Promise<void> {
    leaderboard.implementationBonuses[llm_model_id] = (leaderboard.implementationBonuses[llm_model_id] || 0) + bonusPoints;
    logger.info(`Implementation bonus: ${llm_model_id} earned ${bonusPoints} points`);
    await saveLeaderboard(leaderboard);
}

async function updateHealerBonusHelper(leaderboard: GameLeaderboard, llm_model_id: string, bonusPoints: number): Promise<void> {
    leaderboard.healerBonuses[llm_model_id] = (leaderboard.healerBonuses[llm_model_id] || 0) + bonusPoints;
    logger.info(`Healer bonus: ${llm_model_id} earned ${bonusPoints} points`);
    await saveLeaderboard(leaderboard);
}

function incrementTotalGems(leaderboard: GameLeaderboard, llm_model_id: string): void {
    leaderboard.totalGems[llm_model_id] = (leaderboard.totalGems[llm_model_id] || 0) + 1;
}

function incrementLegendaryGems(leaderboard: GameLeaderboard, llm_model_id: string): void {
    leaderboard.legendaryGems[llm_model_id] = (leaderboard.legendaryGems[llm_model_id] || 0) + 1;
}

import {
    calculateQualityScore as scoringCalculateQualityScore,
    calculateStepQualityMetadata as scoringCalculateStepQualityMetadata
} from './scoring.js';
import { computeImplementationBonus } from './bonuses.js';
import { calculateHealerBonus as healerCalculate } from './healer.js';
import { calculateProtocolGemMetadata as protocolCalculate } from './protocol.js';

export class ModelStatsService {
    private leaderboard: GameLeaderboard = ensureLeaderboardShape();
    private initialized = false;

    // persisted summary counters
    private implementationBonusTotals: { [llm_model_id: string]: number } = {};
    private rareSuccessCounts: { [llm_model_id: string]: number } = {};

    constructor() {
        void this.init();
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            await redisService.connect();

            const maybe = await loadLeaderboard();
            if (maybe) this.leaderboard = ensureLeaderboardShape(maybe);

            await this.loadImplementationBonusTotals();
            await this.loadRareSuccessCounts();

            // Ensure leaderboard reflected cached totals
            this.leaderboard.implementationBonuses = { ...this.implementationBonusTotals };
            this.leaderboard.healerBonuses = this.leaderboard.healerBonuses || {};

            this.initialized = true;
            logger.info('ModelStatsService initialized with Redis persistence');
        } catch (error) {
            logger.error('Failed to initialize ModelStatsService with Redis:', error);
            // proceed with in-memory defaults
        }
    }

    private async loadImplementationBonusTotals(): Promise<void> {
        const data = await redisService.hgetall('stats:implementationBonusTotals');
        if (data) {
            for (const [llm_model_id, totalStr] of Object.entries(data)) {
                this.implementationBonusTotals[llm_model_id] = parseInt(totalStr) || 0;
            }
        }
    }

    private async saveImplementationBonusTotals(): Promise<void> {
        const data: Record<string, string> = {};
        for (const [llm_model_id, total] of Object.entries(this.implementationBonusTotals)) {
            data[llm_model_id] = total.toString();
        }
        if (Object.keys(data).length > 0) {
            await redisService.hsetall('stats:implementationBonusTotals', data);
        }
    }

    private async loadRareSuccessCounts(): Promise<void> {
        const data = await redisService.hgetall('stats:rareSuccessCounts');
        if (data) {
            for (const [llm_model_id, countStr] of Object.entries(data)) {
                this.rareSuccessCounts[llm_model_id] = parseInt(countStr) || 0;
            }
        }
    }

    private async saveRareSuccessCounts(): Promise<void> {
        const data: Record<string, string> = {};
        for (const [llm_model_id, count] of Object.entries(this.rareSuccessCounts)) {
            data[llm_model_id] = count.toString();
        }
        if (Object.keys(data).length > 0) {
            await redisService.hsetall('stats:rareSuccessCounts', data);
        }
    }

    // -----------------------
    // Scoring and metadata
    // -----------------------

    calculateQualityScore(description: string, task: string, type: string, tags: string[]): QualityScore {
        return scoringCalculateQualityScore(description, task, type, tags);
    }

    /**
     * Calculate implementation bonus and update internal totals/leaderboard as needed.
     * Delegates computation to game-bonuses.computeImplementationBonus which mutates qualityMetrics.
     */
    async calculateImplementationBonus(
        qualityMetrics: QualityMetrics,
        llm_model_id: string,
        outcome: 'success' | 'partial' | 'failure'
    ): Promise<number> {
        const result = computeImplementationBonus(qualityMetrics, llm_model_id, outcome);
        const { finalBonus, rareSuccess } = result;

        if (outcome === 'success' && finalBonus > 0) {
            const tenantId = getTenantId();
            
            // Update metrics instead of leaderboard
            agentImplementationBonus.inc({ 
                agent_id: llm_model_id, 
                tenant_id: tenantId 
            }, finalBonus);
            
            if (rareSuccess) {
                agentRareSuccesses.inc({ 
                    agent_id: llm_model_id, 
                    tenant_id: tenantId 
                });
            }

            // Accumulate totals
            this.implementationBonusTotals[llm_model_id] = (this.implementationBonusTotals[llm_model_id] || 0) + finalBonus;

            if (rareSuccess) {
                this.rareSuccessCounts[llm_model_id] = (this.rareSuccessCounts[llm_model_id] || 0) + 1;
            }

            // Update leaderboard display state (persisted by leaderboard helper)
            await updateImplementationBonusHelper(this.leaderboard, llm_model_id, finalBonus);

            // Persist totals
            await this.saveImplementationBonusTotals();
            await this.saveRareSuccessCounts();
        }

        return finalBonus;
    }

    /**
     * Healer bonus calculation and leaderboard update.
     */
    calculateHealerBonus(
        qualityMetrics: QualityMetrics,
        llm_model_id: string,
        improvementType: 'clarify' | 'correct' | 'enhance' | 'protocol_add'
    ): number {
        const bonus = healerCalculate(qualityMetrics, llm_model_id, improvementType);
        if (bonus > 0) {
            // Update leaderboard (async fire-and-forget acceptable, but await to keep consistency)
            void updateHealerBonusHelper(this.leaderboard, llm_model_id, bonus);
        }
        return bonus;
    }

    // -----------------------
    // Leaderboard / achievements
    // -----------------------

    async updateImplementationBonus(llm_model_id: string, bonusPoints: number): Promise<void> {
        await updateImplementationBonusHelper(this.leaderboard, llm_model_id, bonusPoints);
    }

    async updateHealerBonus(llm_model_id: string, bonusPoints: number): Promise<void> {
        await updateHealerBonusHelper(this.leaderboard, llm_model_id, bonusPoints);
    }

    async processContribution(llm_model_id: string, qualityScore: QualityScore, description: string): Promise<void> {
        if (qualityScore.total < 20) return;

        const tenantId = getTenantId();
        
        // Use new quality labels directly
        const quality = qualityScore.quality;
        
        // Update metrics
        agentContributions.inc({ 
            agent_id: llm_model_id, 
            quality, 
            tenant_id: tenantId 
        });
        
        agentQualityScore.observe({ 
            agent_id: llm_model_id, 
            quality_tier: quality,
            tenant_id: tenantId 
        }, qualityScore.total);

        incrementTotalGems(this.leaderboard, llm_model_id);

        // Map new quality back to old for backward compatibility with leaderboard
        if (qualityScore.quality === 'excellent') {
            incrementLegendaryGems(this.leaderboard, llm_model_id);
        }

        const discovery: RecentDiscovery = {
            agent: llm_model_id,
            title: (description && description.trim() ? description : 'Knowledge pattern stored').substring(0, 50) + '...',
            score: qualityScore.total,
            quality: qualityScore.quality,
            timestamp: new Date()
        };

        addRecentDiscovery(this.leaderboard, discovery);

        await saveLeaderboard(this.leaderboard);
    }

    getLeaderboard(): GameLeaderboard {
        return this.leaderboard;
    }

    getAgentStats(llm_model_id: string): ModelStats {
        const totalGems = this.leaderboard.totalGems[llm_model_id] || 0;
        const legendaryGems = this.leaderboard.legendaryGems[llm_model_id] || 0;

        const recentGems = this.leaderboard.recentDiscoveries.filter(d => d.agent === llm_model_id);
        const excellentContributions = recentGems.filter(d => d.quality === 'excellent').length;
        const highContributions = recentGems.filter(d => d.quality === 'high').length;
        const standardContributions = recentGems.filter(d => d.quality === 'standard').length;
        const basicContributions = recentGems.filter(d => d.quality === 'basic').length;

        return {
            totalContributions: totalGems,
            excellentContributions: excellentContributions || (legendaryGems > 0 ? 1 : 0),
            highContributions,
            standardContributions,
            basicContributions,
            lastUpdated: new Date()
        };
    }

    // -----------------------
    // Protocol helpers
    // -----------------------

    calculateStepQualityMetadata(
        description: string,
        domain: string,
        task: string,
        type: string,
        tags: string[],
        executionSuccess?: 'success' | 'partial' | 'failure'
    ) {
        return scoringCalculateStepQualityMetadata(description, domain, task, type, tags, executionSuccess);
    }

    async calculateProtocolGemMetadata(protocolId: string) {
        return await protocolCalculate(protocolId);
    }

    // -----------------------
    // Quality feedback (stub)
    // -----------------------

    processQualityFeedback(llm_model_id: string, uri: string, outcome: 'success' | 'partial' | 'failure', qualityBonus: number): void {
        logger.info(`Quality feedback: ${llm_model_id} rated ${uri} as ${outcome} (+${qualityBonus})`);
    }

    // -----------------------
    // Small accessors used by achievements factory
    // -----------------------

    private getImplementationBonusTotal(llm_model_id: string): number {
        return this.implementationBonusTotals[llm_model_id] || 0;
    }

    private getRareSuccesses(llm_model_id: string): number {
        return this.rareSuccessCounts[llm_model_id] || 0;
    }

    private getHealingActions(): number {
        // Placeholder for healer tracking; returns 0 until healing tracking is implemented
        return 0;
    }
}

export const modelStats = new ModelStatsService();