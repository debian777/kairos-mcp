/**
 * Jest test sequencer: run mint/update tests before v4-kairos-activate (which depends on them).
 */
const path = require('path');
const TestSequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends TestSequencer {
  sort(tests) {
    const v4ActivatePath = path.join(__dirname, 'integration', 'v4-kairos-activate.test.ts');
    return [...tests].sort((a, b) => {
      const aIsMintOrUpdate = /(mint|update)/i.test(a.path) && !/v4-kairos-activate/.test(a.path);
      const bIsMintOrUpdate = /(mint|update)/i.test(b.path) && !/v4-kairos-activate/.test(b.path);
      const aIsV4Activate = a.path === v4ActivatePath || a.path.endsWith('v4-kairos-activate.test.ts');
      const bIsV4Activate = b.path === v4ActivatePath || b.path.endsWith('v4-kairos-activate.test.ts');
      if (aIsV4Activate && bIsMintOrUpdate) return 1;
      if (bIsV4Activate && aIsMintOrUpdate) return -1;
      if (aIsV4Activate && !bIsV4Activate) return 1;
      if (bIsV4Activate && !aIsV4Activate) return -1;
      return 0;
    });
  }
}

module.exports = CustomSequencer;
