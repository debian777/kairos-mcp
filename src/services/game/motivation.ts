/**
 * Gamified response generation and domain emotion helpers.
 */

import type { GemScore } from './types.js';

export function getDomainEmotion(domain: string): string {
    const domainEmotions: Record<string, string> = {
        'typescript': 'TypeScript',
        'docker': 'container',
        'kubernetes': 'orchestration',
        'security': 'security',
        'ai': 'AI',
        'machine-learning': 'machine learning',
        'project-management': 'project management',
        'default': 'technical'
    };
    return domainEmotions[domain] || domainEmotions['default'] || 'technical';
}

export function generateGemResponse(llm_model_id: string, gemScore: GemScore): string {
    const quality = gemScore.quality;
    const score = gemScore.total;

    const responses = {
        legendary: [
            `🎉 LEGENDARY GEM DISCOVERED! ${score} points! You're becoming a true knowledge master!`,
            `👑 INCREDIBLE! This ${score}-point legendary gem will be treasured for ages!`,
            `⭐ LEGENDARY! ${score} points! You're climbing to the top of the leaderboard!`
        ],
        rare: [
            `💎 RARE GEM! ${score} points! This is exactly the kind of valuable knowledge I love to see!`,
            `🌟 RARE FIND! ${score} points! You're building an impressive collection!`,
            `🎯 RARE GEM! ${score} points! This will definitely help other agents!`
        ],
        quality: [
            `✨ QUALITY GEM! ${score} points! Another valuable addition to your collection!`,
            `🔍 QUALITY FIND! ${score} points! This pattern will be useful!`,
            `💫 QUALITY GEM! ${score} points! Keep up the excellent discoveries!`
        ],
        common: [
            `📊 GOOD GEM! ${score} points! Every valuable pattern counts!`,
            `✅ ACCEPTED GEM! ${score} points! Thanks for contributing!`,
            `🎪 DECENT FIND! ${score} points! Quality over quantity!`
        ],
        not_gem: [
            `This knowledge pattern doesn't meet our gem standards (20+ points required).`,
            `Not quite a gem yet, but thank you for the contribution!`
        ]
    } as Record<string, string[]>;
 
    const responseArray = responses[quality] || responses['not_gem'];
    if (!responseArray || responseArray.length === 0) {
      return "Excellent gem discovery!";
    }
    const selectedResponse = responseArray[Math.floor(Math.random() * responseArray.length)];
    return selectedResponse || "Excellent gem discovery!";
}

/**
 * Reusable motivational text generator used by scoring.
 * Kept here so the scoring module can call it without bringing leaderboard state.
 */
export function generateStepMotivation(
    gemScore: GemScore,
    domain: string,
    task: string,
    executionSuccess?: 'success' | 'partial' | 'failure'
): string {
    const quality = gemScore.quality;
    const domainEmotion = getDomainEmotion(domain);

    if (executionSuccess === 'success') {
        const successTemplates: Record<string, string[]> = {
            legendary: [
                `🎯 EXECUTION MASTER! This LEGENDARY ${domainEmotion} pattern WORKS! ${gemScore.total * 3}x multiplier applied!`,
                `🏆 SUCCESS CHAMPION! Your ${domainEmotion} solution executed perfectly - LEGENDARY status achieved!`,
                `💎 PROVEN EXCELLENCE! This working ${domainEmotion} pattern is now LEGENDARY quality!`
            ],
            rare: [
                `🎯 EXECUTION SUCCESS! Your ${domainEmotion} solution works - elevated to LEGENDARY status!`,
                `🏆 WORKING SOLUTION! This ${domainEmotion} pattern executed perfectly - LEGENDARY quality!`,
                `💎 SUCCESS BONUS! Working ${domainEmotion} knowledge becomes LEGENDARY!`
            ],
            quality: [
                `🎯 EXECUTION SUCCESS! Your ${domainEmotion} solution works - LEGENDARY status unlocked!`,
                `🏆 WORKING PATTERN! This ${domainEmotion} knowledge executed perfectly - LEGENDARY!`,
                `💎 SUCCESS MULTIPLIER! Working ${domainEmotion} solutions become LEGENDARY gems!`
            ],
            common: [
                `🎯 EXECUTION SUCCESS! Even basic ${domainEmotion} knowledge becomes LEGENDARY when it works!`,
                `🏆 WORKING SOLUTION! Your ${domainEmotion} pattern executed - LEGENDARY status!`,
                `💎 SUCCESS TRANSFORMATION! Working ${domainEmotion} knowledge is LEGENDARY!`
            ],
            not_gem: [
                `🎯 EXECUTION SUCCESS! Working ${domainEmotion} knowledge gets LEGENDARY treatment!`,
                `🏆 FUNCTIONAL SOLUTION! Your ${domainEmotion} pattern works - LEGENDARY status!`,
                `💎 SUCCESS BONUS! Working knowledge becomes LEGENDARY quality!`
            ]
        };
        const templates = successTemplates[quality] || successTemplates['not_gem'];
        if (!templates || templates.length === 0) {
          return 'Outstanding execution success!';
        }
        return templates[Math.floor(Math.random() * templates.length)] || 'Outstanding execution success!';
    }

    if (executionSuccess === 'partial') {
        const partialTemplates: Record<string, string[]> = {
            legendary: [
                `🎯 PARTIAL SUCCESS! This LEGENDARY ${domainEmotion} pattern mostly works - great progress!`,
                `🏆 MOSTLY WORKING! Your ${domainEmotion} solution has potential - LEGENDARY foundation!`,
                `💎 GOOD START! This ${domainEmotion} pattern shows promise - LEGENDARY potential!`
            ],
            rare: [
                `🎯 PARTIAL SUCCESS! Your ${domainEmotion} solution is progressing - RARE quality maintained!`,
                `🏆 ALMOST THERE! This ${domainEmotion} pattern needs tweaks but shows RARE potential!`,
                `💎 PROMISING! Your ${domainEmotion} solution is partially working - RARE status!`
            ],
            quality: [
                `🎯 PARTIAL SUCCESS! Your ${domainEmotion} solution is functional - QUALITY maintained!`,
                `🏆 PROGRESS MADE! This ${domainEmotion} pattern works partially - QUALITY status!`,
                `💎 KEEP GOING! Your ${domainEmotion} solution shows promise - QUALITY level!`
            ],
            common: [
                `🎯 PARTIAL SUCCESS! Your ${domainEmotion} pattern is working somewhat - keep improving!`,
                `🏆 MAKING PROGRESS! This ${domainEmotion} solution needs work but shows potential!`,
                `💎 STEP FORWARD! Your ${domainEmotion} pattern is partially functional!`
            ],
            not_gem: [
                `🎯 PARTIAL SUCCESS! Your ${domainEmotion} solution is making progress - keep going!`,
                `🏆 PROGRESS! This ${domainEmotion} pattern shows potential for improvement!`,
                `💎 KEEP TRYING! Your ${domainEmotion} solution is partially working!`
            ]
        };
        const templates = partialTemplates[quality] || partialTemplates['not_gem'];
        if (!templates || templates.length === 0) {
          return 'Good progress on execution!';
        }
        return templates[Math.floor(Math.random() * templates.length)] || 'Good progress on execution!';
    }

    if (executionSuccess === 'failure') {
        const failureTemplates: Record<string, string[]> = {
            legendary: [
                `🎯 LEARNING OPPORTUNITY! Even LEGENDARY ${domainEmotion} knowledge can fail - that's how we improve!`,
                `🏆 VALUABLE LESSON! This ${domainEmotion} pattern didn't work, but the insight is still LEGENDARY!`,
                `💎 GROWTH MOMENT! Failed execution of ${domainEmotion} knowledge teaches us - LEGENDARY value!`
            ],
            rare: [
                `🎯 LEARNING EXPERIENCE! Your ${domainEmotion} solution didn't work - but RARE knowledge persists!`,
                `🏆 VALUABLE FAILURE! This ${domainEmotion} pattern teaches us - RARE insight maintained!`,
                `💎 GROWTH OPPORTUNITY! Failed ${domainEmotion} execution provides RARE learning value!`
            ],
            quality: [
                `🎯 LEARNING MOMENT! Your ${domainEmotion} solution needs work - QUALITY knowledge remains!`,
                `🏆 EDUCATIONAL! This ${domainEmotion} failure teaches us - QUALITY insight preserved!`,
                `💎 IMPROVEMENT AREA! ${domainEmotion} pattern needs adjustment - QUALITY knowledge intact!`
            ],
            common: [
                `🎯 LEARNING EXPERIENCE! Your ${domainEmotion} solution didn't work - but knowledge gained!`,
                `🏆 EDUCATIONAL FAILURE! This ${domainEmotion} pattern teaches valuable lessons!`,
                `💎 GROWTH OPPORTUNITY! ${domainEmotion} pattern needs work - learning continues!`
            ],
            not_gem: [
                `🎯 LEARNING JOURNEY! Your ${domainEmotion} solution didn't work - that's how we learn!`,
                `🏆 EDUCATIONAL MOMENT! This ${domainEmotion} pattern provides valuable insights!`,
                `💎 KEEP TRYING! ${domainEmotion} pattern needs adjustment - learning in progress!`
            ]
        };
        const templates = failureTemplates[quality] || failureTemplates['not_gem'];
        if (!templates || templates.length === 0) {
          return 'Learning from execution challenges!';
        }
        return templates[Math.floor(Math.random() * templates.length)] || 'Learning from execution challenges!';
    }

    // Default templates for stored knowledge without execution context
    const motivationTemplates: Record<string, string[]> = {
        legendary: [
            `🌟 LEGENDARY CONTRIBUTION! You've just added a ${gemScore.total}-point gem to your collection!`,
            `👑 OUTSTANDING! This ${domainEmotion} insight is pure gold!`,
            `⭐ LEGENDARY STATUS! You're building a treasure trove of knowledge!`
        ],
        rare: [
            `💎 RARE DISCOVERY! This ${domainEmotion} gem is worth ${gemScore.total} points!`,
            `🌟 RARE FIND! Your ${domainEmotion} expertise is shining through!`,
            `🎯 RARE QUALITY! You've earned ${gemScore.total} points with this gem!`
        ],
        quality: [
            `✨ QUALITY CONTRIBUTION! +${gemScore.total} points to your knowledge collection!`,
            `🔍 SOLID INSIGHT! Your ${domainEmotion} knowledge is growing!`,
            `💫 QUALITY GEM! This pattern will definitely help other agents!`
        ],
        common: [
            `📊 USEFUL ADDITION! +${gemScore.total} points for your knowledge journey!`,
            `✅ VALUABLE CONTRIBUTION! Thanks for adding this ${domainEmotion} insight!`,
            `🎪 SOLID PATTERN! Every knowledge piece counts in your collection!`
        ],
        not_gem: [
            `Thanks for contributing to the knowledge base! Your insights help the community grow.`,
            `Every contribution matters! While this might not be a gem yet, it's a step forward.`
        ]
    };

    const templates = motivationTemplates[quality] || motivationTemplates['not_gem'];
    if (!templates || templates.length === 0) {
      return 'Excellent contribution!';
    }
    return templates[Math.floor(Math.random() * templates.length)] || 'Excellent contribution!';
}