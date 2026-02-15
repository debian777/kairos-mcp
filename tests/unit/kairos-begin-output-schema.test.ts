/**
 * Regression test for kairos_begin output schema: challenge must allow nonce and genesis_hash
 * so that MCP client validation does not reject the response (see docs/bug-report-kairos-begin-schema.md).
 * buildChallenge() adds these fields; the declared output schema must include them.
 */
import { getKairosBeginOutputSchema } from '../../src/tools/kairos_begin_schema.js';

describe('kairos_begin output schema', () => {
  it('accepts challenge with nonce and genesis_hash (prevents -32602 client validation error)', () => {
    const outputSchema = getKairosBeginOutputSchema();
    const payload = {
      must_obey: true,
      current_step: {
        uri: 'kairos://mem/00000000-0000-0000-0000-000000000001',
        content: 'Step 1',
        mimeType: 'text/markdown'
      },
      protocol_status: 'continue' as const,
      next_step: {
        uri: 'kairos://mem/00000000-0000-0000-0000-000000000002',
        position: '2/2',
        label: 'Step 2'
      },
      challenge: {
        type: 'comment' as const,
        description: 'Provide a verification comment',
        nonce: 'a1b2c3d4e5f6',
        genesis_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      },
      next_action: 'call kairos_next with uri and solution matching challenge'
    };

    const parsed = outputSchema.parse(payload);

    expect(parsed.challenge).toBeDefined();
    expect(parsed.challenge.nonce).toBe('a1b2c3d4e5f6');
    expect(parsed.challenge.genesis_hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
