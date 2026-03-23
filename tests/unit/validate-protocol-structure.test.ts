/**
 * Unit tests for `validate-protocol-structure.ts`: adapter markdown validation
 * before `train`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateProtocolStructure,
  CREATION_PROTOCOL_URI
} from '../../src/services/memory/validate-protocol-structure.js';

const validDoc = `# My Adapter

Short description.

## Activation Patterns

Run when user says "do the thing".

**Must Never:** Skip layers.
**Must Always:** Complete all layers.

## Step 1: Do something

Do it.

\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal

Only reachable after all prior layers are solved.`;

describe('validateProtocolStructure', () => {
  test('valid doc passes', () => {
    const result = validateProtocolStructure(validDoc);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.message).toBe('');
  });

  test('missing H1 fails', () => {
    const doc = `## Activation Patterns
Content.

## Step 1
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('h1_title');
    expect(result.message).toMatch(/H1 title/);
  });

  test('missing Activation Patterns (first H2) fails', () => {
    const doc = `# My Adapter

## Step 1 First
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('activation_patterns');
    expect(result.message).toMatch(/Activation Patterns/);
  });

  test('missing Reward Signal (last H2) fails', () => {
    const doc = `# My Adapter

## Activation Patterns
Content.

## Step 1
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Final Step
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('reward_signal');
    expect(result.message).toMatch(/Reward Signal/);
  });

  test('no contract block fails', () => {
    const doc = `# My Adapter

## Activation Patterns
Content.

## Step 1
Just text, no contract.

## Reward Signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('contract_block');
    expect(result.message).toMatch(/contract block/);
  });

  test('case-insensitive Activation Patterns matches', () => {
    const doc = `# My Adapter

## activation patterns

Content.

## Step 1
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain('activation_patterns');
  });

  test('case-insensitive Reward Signal matches', () => {
    const doc = `# My Adapter

## Activation Patterns
Content.

## Step 1
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## reward signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain('reward_signal');
  });

  test('doc with multiple code blocks (typescript, json, javascript, json) passes', () => {
    const doc = `# Code example adapter

## Activation Patterns
Run when user says "code example docs".

## Function Implementation
Here's how to implement a data processor:

\`\`\`typescript
function processData(input: string): string {
  return input.toUpperCase();
}
\`\`\`

\`\`\`json
{"contract":{"type":"shell","shell":{"cmd":"echo implement-processor","timeout_seconds":45},"required":true}}
\`\`\`

## Usage Example

\`\`\`javascript
const processor = new DataProcessor(['hello', 'world']);
\`\`\`

\`\`\`json
{"contract":{"type":"shell","shell":{"cmd":"echo run-processor","timeout_seconds":45},"required":true}}
\`\`\`

## Reward Signal
Only after all steps.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
    expect(result.missing).not.toContain('contract_block');
  });

  test('rejects doc with plain fence containing contract (mixed fences)', () => {
    const doc = `# My Adapter

## Activation Patterns
Content.

## Step 1
\`\`\`
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('mixed_contract_fences');
    expect(result.message).toMatch(/only .*json.* contract/);
  });

  test('multi-H1: each section must have Activation Patterns and Reward Signal', () => {
    const doc = `# First Adapter

## Activation Patterns
First.

## Step A
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
First done.

# Second Adapter

## Step X
No Activation Patterns here.

## Reward Signal
Second done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('activation_patterns');
  });

  test('multi-H1: second adapter missing Reward Signal fails', () => {
    const doc = `# First Adapter

## Activation Patterns
First.

## Reward Signal
First done.

# Second Adapter

## Activation Patterns
Second.

## Last Step
No Reward Signal.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('reward_signal');
  });

  test('multi-H1: first section empty (no H2s) fails validation', () => {
    const doc = `# First Adapter

No H2s here.

# Second Adapter

## Activation Patterns
Second.

## Step A
\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
Second done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('activation_patterns');
  });

  test('H2 inside code block is ignored', () => {
    const doc = `# My Adapter

## Activation Patterns
Content.

## Step 1
Example heading in block:
\`\`\`
## Not a real H2
\`\`\`

\`\`\`json
{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal
Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(true);
  });

  test('rejects contract type that is not a single allowed enum value', () => {
    const doc = `# My Adapter

## Activation Patterns

Run when needed.

## Step 1

Do it.

\`\`\`json
{"contract":{"type":"comment|user_input|mcp|shell","comment":{"min_length":10},"required":true}}
\`\`\`

## Reward Signal

Done.`;
    const result = validateProtocolStructure(doc);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('invalid_contract_type');
    expect(result.message).toMatch(/tensor, shell, mcp, user_input, or comment/);
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
  test('is the creation flow seed UUID', () => {
    expect(CREATION_PROTOCOL_URI).toBe('kairos://adapter/00000000-0000-0000-0000-000000002001');
  });
});
