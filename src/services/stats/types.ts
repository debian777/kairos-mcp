/**
 * Stats types and interfaces for Model Statistics
 *
 * Extracted from the original monolithic implementation to allow
 * modularization of scoring, statistics, and helpers.
 */

export interface QualityScore {
    specificity: number;     // How specific/repeatable (0-10)
    expertValue: number;     // How expert-level knowledge (0-10)
    broadUtility: number;    // How widely applicable (0-10)
    longevity: number;       // How timeless/permanent (0-10)
    total: number;           // Sum of above
    quality: 'excellent' | 'high' | 'standard' | 'basic' | 'below_threshold';
}

export interface ModelStats {
    totalContributions: number;
    excellentContributions: number;
    highContributions: number;
    standardContributions: number;
    basicContributions: number;
    lastUpdated: Date;
}

export interface RecentDiscovery {
    agent: string;
    title: string;
    score: number;
    quality: string;
    timestamp: Date;
}

// GameLeaderboard removed - replaced by Prometheus metrics
// Keeping for backward compatibility during transition
export interface GameLeaderboard {
    totalGems: { [llm_model_id: string]: number };
    legendaryGems: { [llm_model_id: string]: number };
    recentDiscoveries: RecentDiscovery[];
    implementationBonuses: { [llm_model_id: string]: number };
    healerBonuses: { [llm_model_id: string]: number };
}

// Achievement interface kept for backward compatibility but unused
export interface Achievement {
    id: string;
    title: string;
    description: string;
    condition: (stats: ModelStats, llm_model_id?: string) => boolean;
    icon: string;
    category: 'discovery' | 'expertise' | 'volume' | 'special';
}