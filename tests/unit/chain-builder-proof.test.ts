/**
 * Unit tests for chain-builder-proof.ts: challenge block parsing.
 * Tests that only line-start ```json blocks are parsed as steps.
 */

import { findAllChallengeBlocks } from '../../src/services/memory/chain-builder-proof.js';

describe('chain-builder-proof', () => {
  describe('findAllChallengeBlocks', () => {
    test('finds challenge block at line start (after newline)', () => {
      const content = `Some text
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`
More text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(1);
      expect(results[0]!.proof.type).toBe('comment');
      expect(results[0]!.start).toBeGreaterThan(0);
      expect(results[0]!.end).toBeGreaterThan(results[0]!.start);
    });

    test('finds challenge block at content start', () => {
      const content = `\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo test"},"required":true}}
\`\`\`
More text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(1);
      expect(results[0]!.proof.type).toBe('shell');
      expect(results[0]!.start).toBe(0);
    });

    test('does NOT find challenge block with inline prefix', () => {
      const content = `Some text
Example: \`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`
More text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(0);
    });

    test('finds multiple line-start challenge blocks', () => {
      const content = `Step 1 content
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`
Step 2 content
\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"npm test"},"required":true}}
\`\`\`
Step 3 content`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(2);
      expect(results[0]!.proof.type).toBe('comment');
      expect(results[1]!.proof.type).toBe('shell');
      // Verify indices are correct (second block starts after first ends)
      expect(results[1]!.start).toBeGreaterThan(results[0]!.end);
    });

    test('ignores inline-prefixed blocks but finds line-start blocks', () => {
      const content = `Reference section:
Example: \`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Step 1
Do something
\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo done"},"required":true}}
\`\`\``;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(1);
      expect(results[0]!.proof.type).toBe('shell');
    });

    test('handles blocks with ``` (no json) at line start', () => {
      const content = `Some text
\`\`\`
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`
More text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(1);
      expect(results[0]!.proof.type).toBe('comment');
    });

    test('ignores blocks without challenge key', () => {
      const content = `Some text
\`\`\`json
{"not_a_challenge":true}
\`\`\`
More text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(0);
    });

    test('ignores invalid JSON blocks', () => {
      const content = `Some text
\`\`\`json
{invalid json}
\`\`\`
More text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(0);
    });

    test('preserves correct start/end indices for segment slicing', () => {
      const content = `Prefix text
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`
Suffix text`;

      const results = findAllChallengeBlocks(content);
      expect(results).toHaveLength(1);
      
      // Verify the indices allow correct slicing
      const beforeBlock = content.slice(0, results[0]!.start);
      const afterBlock = content.slice(results[0]!.end);
      
      expect(beforeBlock.trim()).toBe('Prefix text');
      expect(afterBlock.trim()).toBe('Suffix text');
    });
  });
});
