'use strict';

/**
 * Standalone `v10` / `V10` is forbidden elsewhere; these paths keep grandfathered
 * copy or suite titles until reworded (`v10-*` module slugs stay valid).
 * @type {string[]}
 */
module.exports = [
  'src/types/memory.ts',
  'src/services/memory/store-methods.ts',
  'src/services/memory/chain-builder-proof.ts',
  'src/resources/embedded-mcp-resources.ts',
  'tests/workflow-test/PROMPT.md',
  'tests/integration/http-api-endpoints.test.ts',
  'tests/integration/v2-kairos-attest.test.ts',
  'tests/integration/v2-kairos-begin.test.ts',
  'tests/integration/v2-kairos-next.test.ts',
  'tests/integration/v2-kairos-search.test.ts',
];
