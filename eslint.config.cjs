// eslint.config.cjs — thin entry; full flat config lives under eslint/
// Forbidden tokens (incl. standalone v10): eslint/plugins/kairos-forbidden-text.cjs
// Grandfathered v10 copy: eslint/rules/forbidden-v10-grandfather.cjs
// Storybook: eslint-plugin-storybook can be added via require() if needed.

'use strict';

const path = require('node:path');
const { createFlatConfig } = require('./eslint/flat-config.cjs');

module.exports = createFlatConfig(path.resolve(__dirname));
