import { buildTuneResultMessage, rewriteTuneMessage } from '../../src/tools/tune-messages.js';

const LAYER_URI = 'kairos://layer/00000000-0000-0000-0000-000000000123';
const MEMORY_URI = 'kairos://mem/00000000-0000-0000-0000-000000000123';

describe('tune result messaging', () => {
  test('rewrites capitalized memory references and memory URIs', () => {
    expect(
      rewriteTuneMessage(`Memory ${MEMORY_URI} updated successfully`, LAYER_URI)
    ).toBe(`Adapter layer ${LAYER_URI} updated successfully`);
  });

  test('builds adapter-layer success messages from canonical layer URIs', () => {
    expect(
      buildTuneResultMessage(
        {
          status: 'updated',
          message: `Memory ${MEMORY_URI} updated successfully`
        },
        LAYER_URI
      )
    ).toBe(`Adapter layer ${LAYER_URI} updated successfully`);
  });

  test('rewrites error messages without losing the failure detail', () => {
    expect(
      buildTuneResultMessage(
        {
          status: 'error',
          message: 'Failed to update memory: Permission denied'
        },
        LAYER_URI
      )
    ).toBe('Failed to update adapter layer: Permission denied');
  });
});
