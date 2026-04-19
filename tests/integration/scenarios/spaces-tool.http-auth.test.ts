import { runSpacesToolContract } from '../contracts/spaces-tool.contract.js';
import { createHttpAuthHarness } from '../harness/http-auth.js';

runSpacesToolContract('spaces tool / http-auth', createHttpAuthHarness);
