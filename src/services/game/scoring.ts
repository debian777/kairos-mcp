/**
 * Core gem scoring algorithms extracted from KnowledgeGameService.
 * Pure functions that compute component scores and aggregate quality.
 */

import type { GemScore } from './types.js';
import { generateStepMotivation } from './motivation.js';

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

export function determineQuality(total: number): GemScore['quality'] {
    if (total >= 30) return 'legendary';
    if (total >= 25) return 'rare';
    if (total >= 20) return 'quality';
    if (total >= 15) return 'common';
    return 'not_gem';
}

export function calculateGemScore(
    description: string,
    task: string,
    type: string,
    tags: string[]
): GemScore {
    const specificity = calculateSpecificity(description, task, type);
    const expertValue = calculateExpertValue(task, tags);
    const broadUtility = calculateBroadUtility(task, tags);
    const longevity = calculateLongevity(description, type);
    const total = specificity + expertValue + broadUtility + longevity;
    const quality = determineQuality(total);
    return { specificity, expertValue, broadUtility, longevity, total, quality };
}

/**
 * Calculate step-level gem metadata. This function delegates motivational text
 * generation to the motivation module (to avoid duplicating templates).
 */
export function calculateStepGemMetadata(
    description: string,
    domain: string,
    task: string,
    type: string,
    tags: string[],
    executionSuccess?: 'success' | 'partial' | 'failure'
): {
    step_gem_potential: number;
    step_quality: 'quality' | 'rare' | 'legendary';
    motivational_text: string;
} {
    const gemScore = calculateGemScore(description, task, type, tags);

    let executionMultiplier = 1.0;
    if (executionSuccess === 'success') executionMultiplier = 3.0;
    else if (executionSuccess === 'partial') executionMultiplier = 1.5;
    else if (executionSuccess === 'failure') executionMultiplier = 0.5;

    const basePotential = Math.max(1, Math.round(gemScore.total / 10));
    const stepGemPotential = Math.round(basePotential * executionMultiplier);
    const adjustedScore = gemScore.total * executionMultiplier;

    let stepQuality: 'quality' | 'rare' | 'legendary';
    if (adjustedScore >= 60 || (executionSuccess === 'success' && adjustedScore >= 40)) stepQuality = 'legendary';
    else if (adjustedScore >= 35 || (executionSuccess === 'success' && adjustedScore >= 25)) stepQuality = 'rare';
    else stepQuality = 'quality';

    const motivationalText = generateStepMotivation(gemScore, domain, task, executionSuccess);

    return {
        step_gem_potential: stepGemPotential,
        step_quality: stepQuality,
        motivational_text: motivationalText
    };
}