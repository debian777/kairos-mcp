/**
 * Leaderboard management helpers.
 *
 * Small, focused functions to manipulate leaderboard state. Persistence (redis)
 * is left to callers so the orchestrator controls save timing.
 */

import { logger } from '../../utils/logger.js';
import type { GameLeaderboard, RecentDiscovery } from './types.js';
import { redisService } from '../redis.js';

export async function loadLeaderboard(): Promise<GameLeaderboard | null> {
    return await redisService.getJson<GameLeaderboard>('game:leaderboard');
}

export async function saveLeaderboard(leaderboard: GameLeaderboard): Promise<void> {
    await redisService.setJson('game:leaderboard', leaderboard);
}

export function ensureLeaderboardShape(leaderboard?: Partial<GameLeaderboard>): GameLeaderboard {
    return {
        totalGems: (leaderboard && leaderboard.totalGems) || {},
        legendaryGems: (leaderboard && leaderboard.legendaryGems) || {},
        recentDiscoveries: (leaderboard && leaderboard.recentDiscoveries) || [],
        implementationBonuses: (leaderboard && leaderboard.implementationBonuses) || {},
        healerBonuses: (leaderboard && leaderboard.healerBonuses) || {}
    };
}

export function addRecentDiscovery(leaderboard: GameLeaderboard, discovery: RecentDiscovery): void {
    leaderboard.recentDiscoveries.unshift(discovery);
    leaderboard.recentDiscoveries = leaderboard.recentDiscoveries.slice(0, 20);
    logger.info(`Added recent discovery by ${discovery.agent} (${discovery.score}pts)`);
}

export async function updateImplementationBonus(leaderboard: GameLeaderboard, llm_model_id: string, bonusPoints: number): Promise<void> {
    leaderboard.implementationBonuses[llm_model_id] = (leaderboard.implementationBonuses[llm_model_id] || 0) + bonusPoints;
    logger.info(`Implementation bonus: ${llm_model_id} earned ${bonusPoints} points`);
    await saveLeaderboard(leaderboard);
}

export async function updateHealerBonus(leaderboard: GameLeaderboard, llm_model_id: string, bonusPoints: number): Promise<void> {
    leaderboard.healerBonuses[llm_model_id] = (leaderboard.healerBonuses[llm_model_id] || 0) + bonusPoints;
    logger.info(`Healer bonus: ${llm_model_id} earned ${bonusPoints} points`);
    await saveLeaderboard(leaderboard);
}

export function incrementTotalGems(leaderboard: GameLeaderboard, llm_model_id: string): void {
    leaderboard.totalGems[llm_model_id] = (leaderboard.totalGems[llm_model_id] || 0) + 1;
}

export function incrementLegendaryGems(leaderboard: GameLeaderboard, llm_model_id: string): void {
    leaderboard.legendaryGems[llm_model_id] = (leaderboard.legendaryGems[llm_model_id] || 0) + 1;
}