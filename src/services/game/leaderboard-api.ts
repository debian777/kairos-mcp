import { knowledgeGame } from './knowledge-game.js';

export async function getLeaderboardData() {
    const leaderboard = knowledgeGame.getLeaderboard();
    return {
        leaderboard: {
            total_gems: Object.entries(leaderboard.totalGems)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 15)
                .reduce((obj, [agent, gems]) => {
                    obj[agent] = gems;
                    return obj;
                }, {} as any),
            legendary_gems: Object.entries(leaderboard.legendaryGems)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 15)
                .reduce((obj, [agent, gems]) => {
                    obj[agent] = gems;
                    return obj;
                }, {} as any),
            implementation_bonuses: Object.entries(leaderboard.implementationBonuses)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 15)
                .reduce((obj, [agent, bonuses]) => {
                    obj[agent] = bonuses;
                    return obj;
                }, {} as any),
            healer_bonuses: Object.entries(leaderboard.healerBonuses)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 15)
                .reduce((obj, [agent, bonuses]) => {
                    obj[agent] = bonuses;
                    return obj;
                }, {} as any),
            recent_discoveries: leaderboard.recentDiscoveries.slice(0, 10)
        },
        game_info: {
            version: '1.0.0',
            title: 'Knowledge Mining Championship',
            description: 'Competitive gem hunting to build the best knowledge collection'
        }
    };
}

export function getAchievementsData() {
    return {
        achievements: [
            {
                id: 'first_gem',
                title: '🔍 Gem Hunter',
                description: 'Stored your first valuable knowledge pattern',
                category: 'discovery',
                icon: '🔍'
            },
            {
                id: 'legendary_hunter',
                title: '👑 Legendary Hunter',
                description: 'Discovered 10+ legendary gems (30+ points)',
                category: 'discovery',
                icon: '👑'
            },
            {
                id: 'implementation_master',
                title: '🎯 Implementation Master',
                description: 'Earned 100+ implementation success bonus points',
                category: 'expertise',
                icon: '🎯'
            },
            {
                id: 'problem_solver',
                title: '🧠 Problem Solver',
                description: 'Successfully implemented knowledge that 5+ other models failed at',
                category: 'expertise',
                icon: '🧠'
            },
            {
                id: 'docker_master',
                title: '🐳 Docker Master',
                description: 'Stored 5+ Docker-related gems',
                category: 'expertise',
                icon: '🐳'
            },
            {
                id: 'security_expert',
                title: '🛡️ Security Expert',
                description: 'Stored 5+ security-related gems',
                category: 'expertise',
                icon: '🛡️'
            },
            {
                id: 'high_volume_contributor',
                title: '🏆 Knowledge Champion',
                description: 'Stored 50+ gems total',
                category: 'volume',
                icon: '🏆'
            }
        ],
        gem_qualities: {
            legendary: {
                points: '30+',
                description: 'Extremely valuable - of timeless worth',
                color: '🟡'
            },
            rare: {
                points: '25-29',
                description: 'Very valuable - highly sought after',
                color: '💎'
            },
            quality: {
                points: '20-24',
                description: 'Valuable - useful for many situations',
                color: '✨'
            },
            common: {
                points: '15-19',
                description: 'Decent value - worth storing',
                color: '📊'
            }
        }
    };
}