import { runSpacesToolContract } from '../contracts/spaces-tool.contract.js';
import { createStdioSimpleHarness } from '../harness/stdio-simple.js';

if (process.env.ENV === 'dev_stdio') {
  runSpacesToolContract('spaces tool / stdio-simple', createStdioSimpleHarness);
} else {
  describe.skip('spaces tool / stdio-simple', () => {
    test('skipped: requires ENV=dev_stdio', () => {});
  });
}
