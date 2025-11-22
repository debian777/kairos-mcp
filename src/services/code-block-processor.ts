// logger import removed because not used

export interface CodeBlock {
  language: string;
  content: string;
  identifiers: string[];
}

export interface CodeProcessingResult {
  codeBlocks: CodeBlock[];
  allIdentifiers: string[];
}

/**
 * Service for extracting and processing code blocks from markdown content
 * to enhance searchability of technical documentation
 */
export class CodeBlockProcessor {
  /**
   * Extract code blocks from markdown content
   */
  extractCodeBlocks(markdown: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const lines = markdown.split(/\r?\n/);

    let inCodeBlock = false;
    let currentBlock: { language: string; content: string[] } | null = null;

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          const language = line.trim().substring(3).trim() || 'text';
          currentBlock = { language, content: [] };
        } else {
          // End of code block
          if (currentBlock) {
            const content = currentBlock.content.join('\n');
            const identifiers = this.extractIdentifiers(content, currentBlock.language);
            codeBlocks.push({
              language: currentBlock.language,
              content,
              identifiers
            });
          }
          inCodeBlock = false;
          currentBlock = null;
        }
      } else if (inCodeBlock && currentBlock) {
        currentBlock.content.push(line);
      }
    }

    return codeBlocks;
  }

  /**
   * Extract searchable identifiers from code content
   */
  private extractIdentifiers(code: string, language: string): string[] {
    const identifiers = new Set<string>();

    // Language-specific patterns
    const patterns = this.getLanguagePatterns(language);

    for (const pattern of patterns) {
      const matches = code.matchAll(pattern.regex);
      for (const match of matches) {
        const identifier = match[1] || match[0];
        if (identifier && identifier.length > 2 && identifier.length < 50) {
          // Filter out common keywords and short fragments
          if (!this.isCommonKeyword(identifier, language)) {
            identifiers.add(identifier.toLowerCase());
          }
        }
      }
    }

    return Array.from(identifiers);
  }

  /**
   * Get regex patterns for extracting identifiers from different languages
   */
  private getLanguagePatterns(language: string): Array<{ regex: RegExp; type: string }> {
    const basePatterns = [
      // Function names (various languages)
      { regex: /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, type: 'function' },
      { regex: /\bdef\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, type: 'function' },
      { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{/g, type: 'function' }, // C-style functions

      // Class names
      { regex: /\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, type: 'class' },

      // Variable/constant declarations
      { regex: /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]/g, type: 'variable' },
      { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]\s*function/g, type: 'variable' },

      // Interface/type names
      { regex: /\binterface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, type: 'interface' },
      { regex: /\btype\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, type: 'type' },

      // Method calls (potential API methods)
      { regex: /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, type: 'method' },

      // Import/require statements
      { regex: /(?:import|from|require)\s+['"]([^'"]+)['"]/g, type: 'import' },
      { regex: /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g, type: 'import' },
    ];

    // Language-specific additions
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'js':
      case 'ts':
        return [
          ...basePatterns,
          // Arrow functions
          { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g, type: 'function' },
          // Export statements
          { regex: /\bexport\s+(?:const|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, type: 'export' },
        ];

      case 'python':
      case 'py':
        return [
          ...basePatterns,
          // Class methods
          { regex: /\bdef\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(self/g, type: 'method' },
        ];

      case 'java':
        return [
          ...basePatterns,
          // Package declarations
          { regex: /\bpackage\s+([a-zA-Z_$][a-zA-Z0-9_$.]*)/g, type: 'package' },
        ];

      case 'csharp':
      case 'c#':
        return [
          ...basePatterns,
          // Namespace
          { regex: /\bnamespace\s+([a-zA-Z_$][a-zA-Z0-9_$.]*)/g, type: 'namespace' },
        ];

      default:
        return basePatterns;
    }
  }

  /**
   * Check if an identifier is a common keyword that shouldn't be indexed
   */
  private isCommonKeyword(identifier: string, language: string): boolean {
    const commonKeywords = new Set([
      'function', 'class', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
      'return', 'import', 'export', 'from', 'require', 'interface', 'type',
      'public', 'private', 'protected', 'static', 'final', 'void', 'int',
      'string', 'boolean', 'object', 'array', 'null', 'undefined', 'true', 'false'
    ]);

    // Language-specific keywords
    const languageKeywords: Record<string, Set<string>> = {
      'javascript': new Set(['console', 'log', 'error', 'warn', 'info', 'document', 'window']),
      'typescript': new Set(['console', 'log', 'error', 'warn', 'info', 'document', 'window', 'any']),
      'python': new Set(['self', 'print', 'len', 'str', 'int', 'list', 'dict', 'set']),
      'java': new Set(['System', 'out', 'println', 'String', 'Integer', 'List', 'Map']),
    };

    const langKeywords = languageKeywords[language.toLowerCase()] || new Set();

    return commonKeywords.has(identifier.toLowerCase()) || langKeywords.has(identifier);
  }

  /**
   * Process markdown content and return code processing results
   */
  processMarkdown(markdown: string): CodeProcessingResult {
    const codeBlocks = this.extractCodeBlocks(markdown);
    const allIdentifiers = codeBlocks.flatMap(block => block.identifiers);

    return {
      codeBlocks,
      allIdentifiers: [...new Set(allIdentifiers)] // Remove duplicates
    };
  }

  /**
   * Enhance text content with code identifiers for better searchability
   */
  enhanceContentForSearch(originalText: string, codeResult: CodeProcessingResult): string {
    if (codeResult.allIdentifiers.length === 0) {
      return originalText;
    }

    // Add code identifiers to the end of the text for search purposes
    // This ensures they're included in embeddings and text search
    const identifierText = codeResult.allIdentifiers.join(' ');
    return `${originalText}\n\n[CODE_IDENTIFIERS: ${identifierText}]`;
  }
}