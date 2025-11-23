/**
 * KnowledgeGameService (orchestrator)
 *
 * Replaces the previous monolithic implementation and delegates responsibilities
 * to modular submodules:
 * - game-types.ts
 * - game-leaderboard.ts
 * - game-achievements.ts
 * - game-scoring.ts
 * - game-bonuses.ts
 * - game-healer.ts
 * - game-motivation.ts
 * - game-protocol.ts
 *
 * The orchestrator keeps minimal state and coordinates persistence via redis.
 */

import { logger } from '../../utils/logger.js';
import { redisService } from '../redis.js';
import type { QualityMetrics } from '../../types/index.js';
import type { GemScore, GameLeaderboard, GameStats, Achievement, RecentDiscovery } from './types.js';
import {
  agentContributions,
  agentImplementationBonus,
  agentRareSuccesses,
  agentQualityScore
} from '../metrics/agent-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

import {
    loadLeaderboard as lbLoad,
    saveLeaderboard as lbSave,
    ensureLeaderboardShape,
    addRecentDiscovery,
    incrementTotalGems,
    incrementLegendaryGems,
    updateImplementationBonus as lbUpdateImpl,
    updateHealerBonus as lbUpdateHealer
} from './leaderboard.js';

import { createDefaultAchievements } from './achievements.js';
import {
    calculateGemScore as scoringCalculateGemScore,
    calculateStepGemMetadata as scoringCalculateStepGemMetadata
} from './scoring.js';
import { computeImplementationBonus } from './bonuses.js';
import { calculateHealerBonus as healerCalculate } from './healer.js';
import { generateGemResponse as motivationGenerateGemResponse } from './motivation.js';
import { calculateProtocolGemMetadata as protocolCalculate } from './protocol.js';

export class KnowledgeGameService {
    private leaderboard: GameLeaderboard = ensureLeaderboardShape();
    private initialized = false;

    // persisted summary counters
    private implementationBonusTotals: { [llm_model_id: string]: number } = {};
    private rareSuccessCounts: { [llm_model_id: string]: number } = {};

    private achievements: Achievement[] = [];

    constructor() {
        // build achievements with accessors bound to this instance
        this.achievements = createDefaultAchievements(
            this.getImplementationBonusTotal.bind(this),
            this.getRareSuccesses.bind(this),
            this.getHealingActions.bind(this)
        );

        void this.init();
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            await redisService.connect();

            const maybe = await lbLoad();
            if (maybe) this.leaderboard = ensureLeaderboardShape(maybe);

            await this.loadImplementationBonusTotals();
            await this.loadRareSuccessCounts();

            // Ensure leaderboard reflected cached totals
            this.leaderboard.implementationBonuses = { ...this.implementationBonusTotals };
            this.leaderboard.healerBonuses = this.leaderboard.healerBonuses || {};

            this.initialized = true;
            logger.info('KnowledgeGameService initialized with Redis persistence');
        } catch (error) {
            logger.error('Failed to initialize KnowledgeGameService with Redis:', error);
            // proceed with in-memory defaults
        }
    }

    private async loadImplementationBonusTotals(): Promise<void> {
        const data = await redisService.hgetall('game:implementationBonusTotals');
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
            await redisService.hsetall('game:implementationBonusTotals', data);
        }
    }

    private async loadRareSuccessCounts(): Promise<void> {
        const data = await redisService.hgetall('game:rareSuccessCounts');
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
            await redisService.hsetall('game:rareSuccessCounts', data);
        }
    }

    // -----------------------
    // Scoring and metadata
    // -----------------------

    calculateGemScore(description: string, task: string, type: string, tags: string[]): GemScore {
        return scoringCalculateGemScore(description, task, type, tags);
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
            await lbUpdateImpl(this.leaderboard, llm_model_id, finalBonus);

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
            void lbUpdateHealer(this.leaderboard, llm_model_id, bonus);
        }
        return bonus;
    }

    // -----------------------
    // Leaderboard / achievements
    // -----------------------

    async updateImplementationBonus(llm_model_id: string, bonusPoints: number): Promise<void> {
        await lbUpdateImpl(this.leaderboard, llm_model_id, bonusPoints);
    }

    async updateHealerBonus(llm_model_id: string, bonusPoints: number): Promise<void> {
        await lbUpdateHealer(this.leaderboard, llm_model_id, bonusPoints);
    }

    async processGemDiscovery(llm_model_id: string, gemScore: GemScore, description: string): Promise<void> {
        if (gemScore.total < 20) return;

        const tenantId = getTenantId();
        
        // Map old quality to new quality labels
        const quality = gemScore.quality === 'legendary' ? 'excellent' :
                       gemScore.quality === 'rare' ? 'high' :
                       gemScore.quality === 'quality' ? 'standard' : 'basic';
        
        // Update metrics instead of leaderboard
        agentContributions.inc({ 
            agent_id: llm_model_id, 
            quality, 
            tenant_id: tenantId 
        });
        
        agentQualityScore.observe({ 
            agent_id: llm_model_id, 
            quality_tier: quality,
            tenant_id: tenantId 
        }, gemScore.total);

        incrementTotalGems(this.leaderboard, llm_model_id);

        if (gemScore.quality === 'legendary') {
            incrementLegendaryGems(this.leaderboard, llm_model_id);
        }

        const discovery: RecentDiscovery = {
            agent: llm_model_id,
            title: (description && description.trim() ? description : 'Knowledge pattern stored').substring(0, 50) + '...',
            score: gemScore.total,
            quality: gemScore.quality,
            timestamp: new Date()
        };

        addRecentDiscovery(this.leaderboard, discovery);

        await lbSave(this.leaderboard);
    }

    getAgentAchievements(llm_model_id: string): Achievement[] {
        const stats = this.getAgentStats(llm_model_id);
        return this.achievements.filter(a => a.condition(stats, llm_model_id));
    }

    getLeaderboard(): GameLeaderboard {
        return this.leaderboard;
    }

    getAgentStats(llm_model_id: string): GameStats {
        const totalGems = this.leaderboard.totalGems[llm_model_id] || 0;
        const legendaryGems = this.leaderboard.legendaryGems[llm_model_id] || 0;

        const recentGems = this.leaderboard.recentDiscoveries.filter(d => d.agent === llm_model_id);
        const rareGems = recentGems.filter(d => d.quality === 'rare').length;
        const qualityGems = recentGems.filter(d => d.quality === 'quality').length;
        const commonGems = recentGems.filter(d => d.quality === 'common').length;

        return {
            totalGems,
            legendaryGems,
            rareGems,
            qualityGems,
            commonGems,
            lastUpdated: new Date()
        };
    }

    // -----------------------
    // Motivation / responses
    // -----------------------

    generateGemResponse(llm_model_id: string, gemScore: GemScore): string {
        return motivationGenerateGemResponse(llm_model_id, gemScore);
    }

    // -----------------------
    // Protocol helpers
    // -----------------------

    calculateStepGemMetadata(
        description: string,
        domain: string,
        task: string,
        type: string,
        tags: string[],
        executionSuccess?: 'success' | 'partial' | 'failure'
    ) {
        return scoringCalculateStepGemMetadata(description, domain, task, type, tags, executionSuccess);
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

export const knowledgeGame = new KnowledgeGameService();