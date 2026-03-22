/**
 * Unit tests for validate-protocol-structure.ts: protocol markdown validation before mint.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateProtocolStructure,
  CREATION_PROTOCOL_URI
} from '../../src/services/memory/validate-protocol-structure.js';

const validDoc = `# My Protocol

Short description.

## Natural Language Triggers

Run when user says "do the thing".

**Must Never:** Skip steps.
**Must Always:** Complete all steps.

## Step 1: Do something

Do it.

\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule

Only reachable after all prior steps are solved.`;

describe('validateProtocolStructure', () => {
  test('valid doc passes', () => {
    const result = validateProtocolStructure(validDoc);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.message).toBe('');
  });

  test('missing H1 fails', () => {
    const doc = `## Natural Language Triggers
Content.

## Step 1
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('h1_title');
    expect(result.message).toMatch(/H1 title/);
  });

  test('missing Natural Language Triggers (first H2) fails', () => {
    const doc = `# My Protocol

## Step 1 First
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('natural_language_triggers');
    expect(result.message).toMatch(/Natural Language Triggers/);
  });

  test('missing Completion Rule (last H2) fails', () => {
    const doc = `# My Protocol

## Natural Language Triggers
Content.

## Step 1
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Final Step
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('completion_rule');
    expect(result.message).toMatch(/Completion Rule/);
  });

  test('no challenge block fails', () => {
    const doc = `# My Protocol

## Natural Language Triggers
Content.

## Step 1
Just text, no challenge.

## Completion Rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('challenge_block');
    expect(result.message).toMatch(/challenge block/);
  });

  test('case-insensitive Natural Language Triggers matches', () => {
    const doc = `# My Protocol

## natural language triggers

Content.

## Step 1
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain('natural_language_triggers');
  });

  test('case-insensitive Completion Rule matches', () => {
    const doc = `# My Protocol

## Natural Language Triggers
Content.

## Step 1
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## completion rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain('completion_rule');
  });

  test('doc with multiple code blocks (typescript, json, javascript, json) passes', () => {
    const doc = `# Code Example Documentation

## Natural Language Triggers
Run when user says "code example docs".

## Function Implementation
Here's how to implement a data processor:

\`\`\`typescript
function processData(input: string): string {
  return input.toUpperCase();
}
\`\`\`

\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo implement-processor","timeout_seconds":45},"required":true}}
\`\`\`

## Usage Example

\`\`\`javascript
const processor = new DataProcessor(['hello', 'world']);
\`\`\`

\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo run-processor","timeout_seconds":45},"required":true}}
\`\`\`

## Completion Rule
Only after all steps.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain('challenge_block');
  });

  test('rejects doc with plain ``` block containing challenge (mixed fences)', () => {
    const doc = `# My Protocol

## Natural Language Triggers
Content.

## Step 1
\`\`\`
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('mixed_challenge_fences');
    expect(result.message).toMatch(/only .*json.* challenge/);
  });

  test('multi-H1: each section must have Triggers and Completion Rule', () => {
    const doc = `# First Protocol

## Natural Language Triggers
First.

## Step A
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
First done.

# Second Protocol

## Step X
No Triggers here.

## Completion Rule
Second done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('natural_language_triggers');
  });

  test('multi-H1: second protocol missing Completion Rule fails', () => {
    const doc = `# First Protocol

## Natural Language Triggers
First.

## Completion Rule
First done.

# Second Protocol

## Natural Language Triggers
Second.

## Last Step
No Completion Rule.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('completion_rule');
  });

  test('multi-H1: first section empty (no H2s) fails validation', () => {
    const doc = `# First Protocol

No H2s here.

# Second Protocol

## Natural Language Triggers
Second.

## Step A
\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Second done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('natural_language_triggers');
  });

  test('H2 inside code block is ignored', () => {
    const doc = `# My Protocol

## Natural Language Triggers
Content.

## Step 1
Example heading in block:
\`\`\`
## Not a real H2
\`\`\`

\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
  });

  test('rejects challenge type that is not a single allowed enum value', () => {
    const doc = `# My Protocol

## Natural Language Triggers

Run when needed.

## Step 1

Do it.

\`\`\`json
{"challenge":{"type":"comment|user_input|mcp|shell","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule

Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('invalid_challenge_type');
    expect(result.message).toMatch(/shell, mcp, user_input, or comment/);
  });

  test('embedded create-new-protocol markdown passes validation', () => {
    const md = readFileSync(
      join(process.cwd(), 'src/embed-docs/mem/00000000-0000-0000-0000-000000002001.md'),
      'utf8'
    );
    const result = validateProtocolStructure(md);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});

describe('CREATION_PROTOCOL_URI', () => {
  test('is the creation protocol mem UUID', () => {
    expect(CREATION_PROTOCOL_URI).toBe('kairos://mem/00000000-0000-0000-0000-000000002001');
  });
});
