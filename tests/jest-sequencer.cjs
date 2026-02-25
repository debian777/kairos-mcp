/**
 * Jest test sequencer: run mint/update tests before v2-kairos-search (which depends on them).
 */
const path = require('path');
const TestSequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends TestSequencer {
  sort(tests) {
    const v2SearchPath = path.join(__dirname, 'integration', 'v2-kairos-search.test.ts');
    return [...tests].sort((a, b) => {
      const aIsMintOrUpdate = /(mint|update)/i.test(a.path) && !/v2-kairos-search/.test(a.path);
      const bIsMintOrUpdate = /(mint|update)/i.test(b.path) && !/v2-kairos-search/.test(b.path);
      const aIsV2Search = a.path === v2SearchPath || a.path.endsWith('v2-kairos-search.test.ts');
      const bIsV2Search = b.path === v2SearchPath || b.path.endsWith('v2-kairos-search.test.ts');
      if (aIsV2Search && bIsMintOrUpdate) return 1;
      if (bIsV2Search && aIsMintOrUpdate) return -1;
      if (aIsV2Search && !bIsV2Search) return 1;
      if (bIsV2Search && !aIsV2Search) return -1;
      return 0;
    });
  }
}

module.exports = CustomSequencer;
