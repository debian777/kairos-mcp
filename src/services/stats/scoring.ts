/**
 * Core quality scoring algorithms extracted from ModelStatsService.
 * Pure functions that compute component scores and aggregate quality.
 */

import type { QualityScore } from './types.js';

export function calculateSpecificity(description: string, task: string, type: string): number {
    let score = 5;
    const specificTerms = ['ECONNREFUSED', 'healthcheck', 'strict mode', 'JWT', 'middleware'];
    if (specificTerms.some(term => description.toLowerCase().includes(term))) score += 2;
    if (description.toLowerCase().includes('error') && task.toLowerCase().includes('troubleshooting')) score += 1;
    if (type === 'pattern' && task.toLowerCase().includes('configuration')) score += 1;
    return Math.min(10, score);
}

export function calculateExpertValue(task: string, tags: string[]): number {
    let score = 5;
    const expertDomains = ['security', 'docker', 'kubernetes', 'typescript', 'postgresql'];
    if (expertDomains.some(d => tags.includes(d) || task.toLowerCase().includes(d))) score += 2;
    const expertTasks = ['optimization', 'security', 'troubleshooting', 'error-handling'];
    if (expertTasks.some(expertTask => task.toLowerCase().includes(expertTask))) score += 1;
    const expertTags = ['timing-attack', 'race-condition', 'performance', 'null-safety'];
    if (expertTags.some(expertTag => tags.includes(expertTag))) score += 1;
    return Math.min(10, score);
}

export function calculateBroadUtility(task: string, tags: string[]): number {
    let score = 5;
    const universalDomains = ['typescript', 'javascript', 'docker', 'postgresql'];
    if (universalDomains.some(u => tags.includes(u) || task.toLowerCase().includes(u))) score += 2;
    const utilityTasks = ['configuration', 'error-handling', 'best-practices'];
    if (utilityTasks.some(utilityTask => task.toLowerCase().includes(utilityTask))) score += 1;
    const commonTags = ['configuration', 'error-handling', 'best-practices'];
    if (commonTags.some(commonTag => tags.includes(commonTag))) score += 1;
    return Math.min(10, score);
}

export function calculateLongevity(description: string, type: string): number {
    let score = 5;
    const desc = description.toLowerCase();
    if (desc.includes('typescript') || desc.includes('docker') || desc.includes('postgresql')) score += 2;
    if (type === 'rule' || type === 'pattern') score += 1;
    if (desc.includes('experimental') || desc.includes('beta')) score -= 2;
    return Math.max(0, Math.min(10, score));
}

export function determineQuality(total: number): QualityScore['quality'] {
    if (total >= 30) return 'excellent';
    if (total >= 25) return 'high';
    if (total >= 20) return 'standard';
    if (total >= 15) return 'basic';
    return 'below_threshold';
}

export function calculateQualityScore(
    description: string,
    task: string,
    type: string,
    tags: string[]
): QualityScore {
    const specificity = calculateSpecificity(description, task, type);
    const expertValue = calculateExpertValue(task, tags);
    const broadUtility = calculateBroadUtility(task, tags);
    const longevity = calculateLongevity(description, type);
    const total = specificity + expertValue + broadUtility + longevity;
    const quality = determineQuality(total);
    return { specificity, expertValue, broadUtility, longevity, total, quality };
}

/**
 * Calculate step-level quality metadata.
 */
export function calculateStepQualityMetadata(
    description: string,
    domain: string,
    task: string,
    type: string,
    tags: string[],
    executionSuccess?: 'success' | 'partial' | 'failure'
): {
    step_quality_score: number;
    step_quality: 'excellent' | 'high' | 'standard' | 'basic';
} {
    const qualityScore = calculateQualityScore(description, task, type, tags);

    let executionMultiplier = 1.0;
    if (executionSuccess === 'success') executionMultiplier = 3.0;
    else if (executionSuccess === 'partial') executionMultiplier = 1.5;
    else if (executionSuccess === 'failure') executionMultiplier = 0.5;

    const baseScore = Math.max(1, Math.round(qualityScore.total / 10));
    const stepQualityScore = Math.round(baseScore * executionMultiplier);
    const adjustedScore = qualityScore.total * executionMultiplier;

    let stepQuality: 'excellent' | 'high' | 'standard' | 'basic';
    if (adjustedScore >= 60 || (executionSuccess === 'success' && adjustedScore >= 40)) stepQuality = 'excellent';
    else if (adjustedScore >= 35 || (executionSuccess === 'success' && adjustedScore >= 25)) stepQuality = 'high';
    else if (adjustedScore >= 20) stepQuality = 'standard';
    else stepQuality = 'basic';

    return {
        step_quality_score: stepQualityScore,
        step_quality: stepQuality
    };
}