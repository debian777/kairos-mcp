/**
 * Gem Information Templates
 * 
 * Standardized templates for displaying gem metadata and motivational messages
 * across KAIROS tools and responses.
 */

import { logger } from './logger.js';

export interface GemTemplate {
    icon: string;
    color: string;
    background: string;
    message: string;
    urgency: 'low' | 'medium' | 'high' | 'epic';
}

/**
 * Get template for gem quality level
 */
export function getGemTemplate(quality: 'quality' | 'rare' | 'legendary'): GemTemplate {
    const templates = {
        quality: {
            icon: '✨',
            color: '#4A90E2',
            background: '#E8F4FD',
            message: 'Quality Contribution',
            urgency: 'low' as const
        },
        rare: {
            icon: '💎',
            color: '#F39C12',
            background: '#FEF5E7',
            message: 'Rare Discovery',
            urgency: 'medium' as const
        },
        legendary: {
            icon: '👑',
            color: '#8E44AD',
            background: '#F4ECF7',
            message: 'Legendary Contribution',
            urgency: 'epic' as const
        }
    };

    return templates[quality] || templates.quality;
}

/**
 * Format gem score for display
 */
export function formatGemScore(score: number): string {
    if (score >= 30) {
        return `${score} pts 👑`;
    } else if (score >= 25) {
        return `${score} pts 💎`;
    } else if (score >= 20) {
        return `${score} pts 🌟`;
    } else {
        return `${score} pts ✨`;
    }
}

/**
 * Generate gem summary text for protocol
 */
export function generateGemSummary(workflowPotential: number, workflowQuality: string): string {
    const templates = {
        'Legendary Workflow': '🏆 This workflow is pure legend!',
        'Rare Workflow': '💎 A rare and valuable workflow!',
        'Quality Workflow': '⭐ High-quality workflow with great gems!',
        'Standard Protocol': '📚 A solid knowledge protocol.'
    };

    const baseMessage = templates[workflowQuality as keyof typeof templates] || '📖 A valuable knowledge protocol.';
    return `${baseMessage} Total gem potential: ${workflowPotential} points.`;
}

/**
 * Format gem metadata for display in search results
 */
export function formatGemMetadata(gemMetadata: {
    step_gem_potential?: number;
    step_quality?: string;
    workflow_total_potential?: number;
    workflow_quality?: string;
    motivational_text?: string;
}) {
    const stepPotential = gemMetadata.step_gem_potential || 1;
    const stepQuality = gemMetadata.step_quality || 'quality';
    const workflowPotential = gemMetadata.workflow_total_potential || stepPotential;
    const workflowQuality = gemMetadata.workflow_quality || 'Standard Protocol';
    const motivationalText = gemMetadata.motivational_text || 'This knowledge pattern contributes to your learning journey.';

    const template = getGemTemplate(stepQuality as 'quality' | 'rare' | 'legendary');

    return {
        display: {
            icon: template.icon,
            color: template.color,
            background: template.background,
            qualityLabel: template.message,
            urgency: template.urgency,
            gemScore: formatGemScore(stepPotential),
            workflowSummary: generateGemSummary(workflowPotential, workflowQuality),
            motivationalMessage: motivationalText
        },
        raw: gemMetadata
    };
}

/**
 * Generate progress indicator for gem accumulation
 */
export function generateGemProgress(currentGems: number, targetGems: number = 20): {
    percentage: number;
    remaining: number;
    encouragement: string;
} {
    const percentage = Math.min(100, Math.round((currentGems / targetGems) * 100));
    const remaining = Math.max(0, targetGems - currentGems);

    let encouragement: string;
    if (percentage >= 100) {
        encouragement = '🎉 Goal achieved! You\'re a gem master!';
    } else if (percentage >= 75) {
        encouragement = '🔥 Almost there! Just a few more gems to unlock the next level!';
    } else if (percentage >= 50) {
        encouragement = '💪 Great progress! Keep collecting those valuable insights!';
    } else if (percentage >= 25) {
        encouragement = '✨ Good start! Every gem counts toward your collection!';
    } else {
        encouragement = '🌟 Welcome to the knowledge journey! Each contribution matters!';
    }

    return {
        percentage,
        remaining,
        encouragement
    };
}

/**
 * Create gem collection summary for user feedback
 */
export function createGemCollectionSummary(
    stepGem: { potential: number; quality: string; score: number },
    workflowGem?: { totalPotential: number; quality: string }
) {
    const stepTemplate = getGemTemplate(stepGem.quality as 'quality' | 'rare' | 'legendary');

    const summary = {
        step: {
            icon: stepTemplate.icon,
            quality: stepGem.quality,
            potential: stepGem.potential,
            score: formatGemScore(stepGem.score),
            message: stepTemplate.message
        }
    };

    if (workflowGem) {
        const workflowTemplate = getGemTemplate(workflowGem.quality as 'quality' | 'rare' | 'legendary');
        (summary as any).workflow = {
            icon: workflowTemplate.icon,
            quality: workflowGem.quality,
            totalPotential: workflowGem.totalPotential,
            summary: generateGemSummary(workflowGem.totalPotential, workflowGem.quality)
        };
    }

    return summary;
}

/**
 * Log gem-related events for analytics
 */
export function logGemEvent(event: string, data: any) {
    const logMessage = `[GemEvent] ${event} - ${JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...data
    })}`;
    logger.info(logMessage);
}