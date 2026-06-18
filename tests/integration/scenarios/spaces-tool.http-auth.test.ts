import { runSpacesToolContract } from '../contracts/spaces-tool.contract.js';
import { createHttpAuthHarness } from '../harness/http-auth.js';
import { isHttpTransport } from '../../utils/auth-headers.js';

if (isHttpTransport()) {
  runSpacesToolContract('spaces tool / http-auth', createHttpAuthHarness);
} else {
  describe.skip('spaces tool / http-auth', () => {
    test('skipped: requires HTTP transport', () => {});
  });
}
