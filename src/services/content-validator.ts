import { logger } from '../utils/logger.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: string | undefined;
}

export interface ValidationOptions {
  maxLength?: number;
  allowHtml?: boolean;
  checkDuplicates?: boolean;
  checkStructuredPrompts?: boolean;
}

/**
 * Content validation and sanitization service
 * Implements quality control pipeline as specified in appendix
 */
export class ContentValidator {
  private readonly DEFAULT_MAX_LENGTH = 8000;
  private readonly DANGEROUS_HTML_TAGS = [
    'script', 'iframe', 'embed', 'object', 'form', 'input', 
    'textarea', 'select', 'button', 'meta', 'link', 'style'
  ];

  /**
   * Validate content with comprehensive quality checks
   */
  validateContent(content: string, options: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedContent = content;

    // 1. Markdown sanitization - strip dangerous HTML
    const sanitizationResult = this.sanitizeMarkdown(content);
    if (sanitizationResult.wasModified) {
      warnings.push(`Removed potentially dangerous HTML elements`);
    }
    sanitizedContent = sanitizationResult.content;

    // 2. Length limits check
    const lengthCheck = this.checkLengthLimits(sanitizedContent, options.maxLength || this.DEFAULT_MAX_LENGTH);
    if (!lengthCheck.isValid) {
      errors.push(...lengthCheck.errors);
    }

    // 3. Duplicate detection (basic)
    if (options.checkDuplicates && this.hasSuspiciousDuplicates(sanitizedContent)) {
      warnings.push('Content appears to contain duplicates');
    }

    // 4. Structured prompts validation
    if (options.checkStructuredPrompts) {
      const promptValidation = this.validateStructuredPrompts(sanitizedContent);
      if (!promptValidation.isValid) {
        warnings.push(...promptValidation.warnings);
      }
    }

    // 5. Content type verification
    const contentCheck = this.validateContentStructure(sanitizedContent);
    if (!contentCheck.isValid) {
      warnings.push(...contentCheck.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedContent: sanitizedContent !== content ? sanitizedContent : undefined as string | undefined
    };
  }

  /**
   * Batch validate multiple content items
   */
  batchValidate(contents: string[], options: ValidationOptions = {}): ValidationResult[] {
    return contents.map(content => this.validateContent(content, options));
  }

  /**
   * Sanitize markdown by removing dangerous HTML
   */
  private sanitizeMarkdown(content: string): { content: string; wasModified: boolean } {
    let modified = false;
    let sanitized = content;

    // Remove dangerous HTML tags and their content
    for (const tag of this.DANGEROUS_HTML_TAGS) {
      const regex = new RegExp(`<\\s*${tag}[^>]*>.*?<\\s*\\/\\s*${tag}\\s*>`, 'gis');
      if (regex.test(sanitized)) {
        sanitized = sanitized.replace(regex, '');
        modified = true;
      }

      // Also remove self-closing tags
      const selfClosingRegex = new RegExp(`<\\s*${tag}[^>]*\\/?>`, 'gi');
      if (selfClosingRegex.test(sanitized)) {
        sanitized = sanitized.replace(selfClosingRegex, '');
        modified = true;
      }
    }

    // Remove javascript: URLs
    const jsUrlRegex = /javascript:/gi;
    if (jsUrlRegex.test(sanitized)) {
      sanitized = sanitized.replace(jsUrlRegex, '');
      modified = true;
    }

    // Clean up excessive whitespace
    const cleanWhitespace = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n');
    if (cleanWhitespace !== sanitized) {
      sanitized = cleanWhitespace;
      modified = true;
    }

    return { content: sanitized, wasModified: modified };
  }

  /**
   * Check content length limits
   */
  private checkLengthLimits(content: string, maxLength: number): ValidationResult {
    const errors: string[] = [];
    
    if (content.length > maxLength) {
      errors.push(`Content too long: ${content.length} characters (max: ${maxLength})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Basic duplicate detection
   */
  private hasSuspiciousDuplicates(content: string): boolean {
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 3) { // Only check words longer than 3 characters
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    }

    // If any word appears more than 10 times, flag as suspicious
    for (const count of wordCount.values()) {
      if (count > 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate structured prompts format
   */
  private validateStructuredPrompts(content: string): ValidationResult {
    const warnings: string[] = [];
    
    // Check for "What Next" format
    const whatNextPattern = /what\s+next/i;
    if (!whatNextPattern.test(content)) {
      warnings.push('Consider adding "What Next:" section for better workflow guidance');
    }

    // Check for code examples
    const codeBlockPattern = /```/g;
    const codeBlocks = content.match(codeBlockPattern);
    if (!codeBlocks || codeBlocks.length === 0) {
      warnings.push('Consider adding code examples for better implementation guidance');
    }

    return {
      isValid: true, // These are warnings, not errors
      errors: [],
      warnings
    };
  }

  /**
   * Validate content structure
   */
  private validateContentStructure(content: string): ValidationResult {
    const warnings: string[] = [];
    
    // Check for common content issues
    if (content.trim().length < 10) {
      warnings.push('Content is very short - consider adding more detail');
    }

    // Check for proper markdown formatting
    if (!content.includes('#') && !content.includes('*') && !content.includes('_')) {
      warnings.push('Content could benefit from markdown formatting (headers, emphasis, etc.)');
    }

    // Check for excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.3) {
      warnings.push('High ratio of uppercase letters - consider more readable formatting');
    }

    return {
      isValid: true,
      errors: [],
      warnings
    };
  }

  /**
   * Log validation results for debugging and analytics
   */
  private logValidation(content: string, result: ValidationResult): void {
    if (!result.isValid) {
      logger.warn(`Content validation failed: ${result.errors.join(', ')}`);
    }
    
    if (result.warnings.length > 0) {
      logger.info(`Content validation warnings: ${result.warnings.join(', ')}`);
    }

    if (result.sanitizedContent && result.sanitizedContent !== content) {
      logger.info('Content was sanitized for safety');
    }
  }

  /**
   * Get validation summary statistics
   */
  getValidationStats(results: ValidationResult[]): {
    totalItems: number;
    validItems: number;
    totalErrors: number;
    totalWarnings: number;
    sanitizedItems: number;
  } {
    const totalItems = results.length;
    const validItems = results.filter(r => r.isValid).length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const sanitizedItems = results.filter(r => r.sanitizedContent).length;

    return {
      totalItems,
      validItems,
      totalErrors,
      totalWarnings,
      sanitizedItems
    };
  }
}