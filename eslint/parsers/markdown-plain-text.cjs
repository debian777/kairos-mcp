'use strict';

/**
 * Parse Markdown as plain text for rules that only call sourceCode.getText()
 * (no JS syntax in body).
 */
const markdownPlainTextParser = {
  parseForESLint(text) {
    const ast = {
      type: 'Program',
      start: 0,
      end: text.length,
      range: [0, text.length],
      loc: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
      body: [],
      sourceType: 'module',
      comments: [],
      tokens: [],
    };
    return {
      ast,
      scopeManager: null,
      visitorKeys: { Program: [] },
    };
  },
};

module.exports = { markdownPlainTextParser };
