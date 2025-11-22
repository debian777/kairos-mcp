import { logger } from '../utils/logger.js';

export type ContentType = 'rule' | 'pattern' | 'snippet' | 'context';

export interface ContentDetectionResult {
  type: ContentType;
  confidence: number;
  reasoning: string;
}

/**
 * Aggressive content type detection prioritizing rule/pattern/snippet,
 * with context as fallback only when others are not detected.
 */
export class ContentTypeDetector {
  /**
   * Auto-detect content_type from markdown content
   * Priority: snippet > rule > pattern > context (fallback)
   */
  detectContentType(content: string): ContentDetectionResult {
    const trimmed = content.trim().toLowerCase();

    // Priority 1: Snippet detection (fenced code blocks)
    const snippetResult = this.detectSnippet(trimmed);
    if (snippetResult.confidence >= 0.8) {
      return snippetResult;
    }

    // Priority 2: Rule detection (prescriptive language)
    const ruleResult = this.detectRule(trimmed);
    if (ruleResult.confidence >= 0.8) {
      return ruleResult;
    }

    // Priority 3: Pattern detection (architectural language)
    const patternResult = this.detectPattern(trimmed);
    if (patternResult.confidence >= 0.8) {
      return patternResult;
    }

    // Fallback: Context (contextual/explanatory content)
    // This should only be used when no other types are clearly detected
    return {
      type: 'context',
      confidence: 0.6, // Lower confidence as fallback
      reasoning: 'No strong indicators for rule/pattern/snippet; classified as contextual content'
    };
  }

  /**
   * Detect code snippets with high confidence
   */
  private detectSnippet(content: string): ContentDetectionResult {
    const codeIndicators = [
      { pattern: /```[\w]*\n/, weight: 0.9, desc: 'Fenced code block' },
      { pattern: /`[^`]+`/, weight: 0.7, desc: 'Inline code' },
      { pattern: /function\s+\w+\s*\(/, weight: 0.8, desc: 'Function declaration' },
      { pattern: /class\s+\w+\s*{/, weight: 0.8, desc: 'Class declaration' },
      { pattern: /const\s+\w+\s*=\s*function/, weight: 0.7, desc: 'Function assignment' },
      { pattern: /=>/, weight: 0.6, desc: 'Arrow function' },
      { pattern: /console\.log\(/, weight: 0.5, desc: 'Console logging' }
    ];

    let maxScore = 0;
    let reasoning = '';

    for (const indicator of codeIndicators) {
      if (indicator.pattern.test(content)) {
        maxScore = Math.max(maxScore, indicator.weight);
        reasoning = reasoning ? `${reasoning}; ${indicator.desc}` : indicator.desc;
      }
    }

    if (maxScore > 0) {
      return {
        type: 'snippet',
        confidence: maxScore,
        reasoning: `Detected code indicators: ${reasoning}`
      };
    }

    return {
      type: 'snippet',
      confidence: 0.1,
      reasoning: 'No clear code indicators found'
    };
  }

  /**
   * Detect prescriptive rules with high confidence
   */
  private detectRule(content: string): ContentDetectionResult {
    const ruleIndicators = [
      { pattern: /^(always|never|must|should|avoid|ensure|never\s+never)/i, weight: 0.9, desc: 'Prescriptive directive' },
      { pattern: /you\s+(must|should|never|always)/i, weight: 0.8, desc: 'Direct instruction' },
      { pattern: /this\s+(prevents|ensures|guarantees)/i, weight: 0.7, desc: 'Preventive language' },
      { pattern: /do\s+not|don't/i, weight: 0.7, desc: 'Negative directive' },
      { pattern: /best\s+practice/i, weight: 0.6, desc: 'Best practice indicator' },
      { pattern: /security\s+vulnerab|attack|exploit/i, weight: 0.8, desc: 'Security concern' },
      { pattern: /error|exception|handle/i, weight: 0.6, desc: 'Error handling' }
    ];

    let maxScore = 0;
    let reasoning = '';

    for (const indicator of ruleIndicators) {
      if (indicator.pattern.test(content)) {
        maxScore = Math.max(maxScore, indicator.weight);
        reasoning = reasoning ? `${reasoning}; ${indicator.desc}` : indicator.desc;
      }
    }

    if (maxScore > 0) {
      return {
        type: 'rule',
        confidence: maxScore,
        reasoning: `Detected rule indicators: ${reasoning}`
      };
    }

    return {
      type: 'rule',
      confidence: 0.1,
      reasoning: 'No clear rule indicators found'
    };
  }

  /**
   * Detect architectural patterns with high confidence
   */
  private detectPattern(content: string): ContentDetectionResult {
    const patternIndicators = [
      { pattern: /pattern/i, weight: 0.9, desc: 'Pattern keyword' },
      { pattern: /architecture/i, weight: 0.8, desc: 'Architecture term' },
      { pattern: /design\s+pattern/i, weight: 0.9, desc: 'Design pattern' },
      { pattern: /singleton|factory|observer|strategy/i, weight: 0.8, desc: 'Named pattern' },
      { pattern: /when\s+you\s+need.*consider/i, weight: 0.7, desc: 'Conditional guidance' },
      { pattern: /this\s+is\s+useful\s+when/i, weight: 0.6, desc: 'Use case guidance' },
      { pattern: /approach|methodology|framework/i, weight: 0.6, desc: 'Methodological approach' },
      { pattern: /structure|organization|layout/i, weight: 0.5, desc: 'Structural guidance' }
    ];

    let maxScore = 0;
    let reasoning = '';

    for (const indicator of patternIndicators) {
      if (indicator.pattern.test(content)) {
        maxScore = Math.max(maxScore, indicator.weight);
        reasoning = reasoning ? `${reasoning}; ${indicator.desc}` : indicator.desc;
      }
    }

    if (maxScore > 0) {
      return {
        type: 'pattern',
        confidence: maxScore,
        reasoning: `Detected pattern indicators: ${reasoning}`
      };
    }

    return {
      type: 'pattern',
      confidence: 0.1,
      reasoning: 'No clear pattern indicators found'
    };
  }

  /**
   * Validate detection result and return the appropriate content type
   */
  validateAndGetType(content: string): { type: ContentType; confidence: number; reasoning: string; needsReview: boolean } {
    const result = this.detectContentType(content);

    // Enhanced confidence thresholds based on appendix recommendations
    const needsReview = result.confidence < 0.6;

    return {
      type: result.type,
      confidence: result.confidence,
      reasoning: result.reasoning,
      needsReview
    };
  }

  /**
   * Batch detect content types for multiple items
   */
  batchDetect(contents: string[]): Array<{ type: ContentType; confidence: number; reasoning: string; needsReview: boolean }> {
    return contents.map(content => this.validateAndGetType(content));
  }

  /**
   * Log detection results for debugging and analytics
   */
  private logDetection(content: string, result: ContentDetectionResult): void {
    logger.debug(`Content type detection: ${result.type} (${result.confidence}) - ${result.reasoning}`);
    if (result.confidence < 0.6) {
      logger.warn(`Low confidence content detection: ${result.type} (${result.confidence}) for content: "${content.substring(0, 100)}..."`);
    }
  }
}