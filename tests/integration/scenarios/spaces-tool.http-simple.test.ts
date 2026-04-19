import { runSpacesToolContract } from '../contracts/spaces-tool.contract.js';
import { createHttpSimpleHarness } from '../harness/http-simple.js';

runSpacesToolContract('spaces tool / http-simple', createHttpSimpleHarness);
