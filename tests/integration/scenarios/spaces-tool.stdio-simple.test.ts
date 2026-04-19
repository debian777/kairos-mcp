import { runSpacesToolContract } from '../contracts/spaces-tool.contract.js';
import { createStdioSimpleHarness } from '../harness/stdio-simple.js';

runSpacesToolContract('spaces tool / stdio-simple', createStdioSimpleHarness);
