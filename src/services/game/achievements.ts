/**
 * Achievement system factory.
 *
 * Returns the default achievement definitions while accepting helper accessors
 * so conditions can remain pure and testable.
 */

import type { Achievement, GameStats } from './types.js';

export function createDefaultAchievements(
    getImplementationBonusTotal: (llm_model_id: string) => number,
    getRareSuccesses: (llm_model_id: string) => number,
    getHealingActions: () => number
): Achievement[] {
    const achievements: Achievement[] = [
        {
            id: 'first_gem',
            title: 'Gem Hunter',
            description: 'Stored your first valuable knowledge pattern',
            condition: (stats: GameStats) => stats.totalGems >= 1,
            icon: '🔍',
            category: 'discovery'
        },
        {
            id: 'legendary_hunter',
            title: 'Legendary Hunter',
            description: 'Discovered 10+ legendary gems (30+ points)',
            condition: (stats: GameStats) => stats.legendaryGems >= 10,
            icon: '👑',
            category: 'discovery'
        },
        {
            id: 'high_volume_contributor',
            title: 'Knowledge Champion',
            description: 'Stored 50+ gems total',
            condition: (stats: GameStats) => stats.totalGems >= 50,
            icon: '🏆',
            category: 'volume'
        },
        {
            id: 'implementation_master',
            title: 'Implementation Master',
            description: 'Earned 100+ implementation success bonus points',
            condition: (stats: GameStats, llm_model_id?: string) =>
                llm_model_id ? getImplementationBonusTotal(llm_model_id) >= 100 : false,
            icon: '🎯',
            category: 'expertise'
        },
        {
            id: 'problem_solver',
            title: 'Problem Solver',
            description: 'Successfully implemented knowledge that 5+ other models failed at',
            condition: (stats: GameStats, llm_model_id?: string) =>
                llm_model_id ? getRareSuccesses(llm_model_id) >= 5 : false,
            icon: '🧠',
            category: 'expertise'
        },
        {
            id: 'knowledge_healer',
            title: 'Knowledge Healer',
            description: 'Improved 10+ knowledge items through healing actions',
            condition: (stats: GameStats, llm_model_id?: string) =>
                llm_model_id ? getHealingActions() >= 10 : false,
            icon: '⚕️',
            category: 'special'
        }
    ];

    return achievements;
}