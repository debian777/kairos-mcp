/**
 * Game types and interfaces for Knowledge Mining Game
 *
 * Extracted from the original monolithic implementation to allow
 * modularization of scoring, leaderboard, achievements, and helpers.
 */

export interface GemScore {
    specificity: number;     // How specific/repeatable (0-10)
    expertValue: number;     // How expert-level knowledge (0-10)
    broadUtility: number;    // How widely applicable (0-10)
    longevity: number;       // How timeless/permanent (0-10)
    total: number;           // Sum of above
    quality: 'legendary' | 'rare' | 'quality' | 'common' | 'not_gem';
}

export interface GameStats {
    totalGems: number;
    legendaryGems: number;
    rareGems: number;
    qualityGems: number;
    commonGems: number;
    lastUpdated: Date;
}

export interface RecentDiscovery {
    agent: string;
    title: string;
    score: number;
    quality: string;
    timestamp: Date;
}

export interface GameLeaderboard {
    totalGems: { [llm_model_id: string]: number };
    legendaryGems: { [llm_model_id: string]: number };
    recentDiscoveries: RecentDiscovery[];
    implementationBonuses: { [llm_model_id: string]: number };
    healerBonuses: { [llm_model_id: string]: number };
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    condition: (stats: GameStats, llm_model_id?: string) => boolean;
    icon: string;
    category: 'discovery' | 'expertise' | 'volume' | 'special';
}