// eslint.config.cjs — thin entry; full flat config lives under eslint/
// Forbidden tokens + protocol wording review: eslint/plugins/kairos-forbidden-text.cjs
// CodeQL `// codeql[js/…]:` line integrity: eslint/plugins/kairos-codeql-line-comments.cjs
// MCP Apps widgets (handshake + HTML shell): eslint/plugins/kairos-mcp-widget.cjs
// Scope: src/, scripts/, tests/ code + **/*.md + context7.json (see eslint/flat-config.cjs)
// Inline eslint-disable / file comments cannot change rules (linterOptions.noInlineConfig).

'use strict';

const path = require('node:path');
const { createFlatConfig } = require('./eslint/flat-config.cjs');

module.exports = createFlatConfig(path.resolve(__dirname));
