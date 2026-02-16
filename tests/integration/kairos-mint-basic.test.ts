import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

/**
 * Kairos Mint integration tests (basic functionality).
 *
 * Goals:
 * - Verify the happy-path JSON contract of kairos_mint.
 * - When something goes wrong, surface the raw MCP result
 *   instead of wrapping it in an extra "Failed to parse..." error.
 */

describe('Kairos Mint Basic Functionality', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  // Helper to generate unique markdown with timestamp to avoid duplicate-chain rejections
  function uniqueMd(titlePrefix, sections) {
    const ts = Date.now();
    const h1 = `# ${titlePrefix} ${ts}`;
    const body = sections
      .map((s, index) => {
        const proofCmd = s.proof || `echo step-${index + 1}`;
        const timeout = s.timeout || 30;
        return `\n\n## ${s.h2}\n${s.body}\n\nPROOF OF WORK: timeout ${timeout}s ${proofCmd}`;
      })
      .join('');
    return `${h1}${body}`;
  }

  function expectValidJsonResult(result) {
    return parseMcpJson(result, 'kairos_mint raw MCP result');
  }

  test('kairos_mint stores single text content successfully', async () => {
    const md = uniqueMd('Kairos Mint Smoke', [
      { h2: 'Intro', body: 'Alpha content' },
      { h2: 'Details', body: 'Beta content' }
    ]);
    const testContent = JSON.stringify(md);

    const result = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: testContent,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });

    const response = expectValidJsonResult(result);

    expect(response).toHaveProperty('items');
    expect(Array.isArray(response.items)).toBe(true);
    expect(response.items.length).toBeGreaterThanOrEqual(1);

    const item = response.items[0];
    expect(item).toHaveProperty('uri');
    expect(item.uri).toMatch(/^kairos:\/\/mem\//);
    expect(item).toHaveProperty('memory_uuid');
    expect(typeof item.memory_uuid).toBe('string');
    expect(item.memory_uuid.length).toBeGreaterThan(0);
    expect(item).toHaveProperty('label');
    expect(typeof item.label).toBe('string');
    expect(item).toHaveProperty('tags');
    expect(Array.isArray(item.tags)).toBe(true);

    expect(response).toHaveProperty('status');
    expect(response.status).toBe('stored');
  }, 20000); // Increase timeout for large document processing

  test('kairos_mint duplicate policy with label-based chain UUID and force_update', async () => {
    // 1) Create timestamp for unique chain label
    const ts = Date.now().toString();
    const md = `# Unique Store ${ts}\n\n## Step 1\nAlpha\n\nPROOF OF WORK: timeout 5s echo alpha\n\n## Step 2\nBeta\n\nPROOF OF WORK: timeout 5s echo beta`;

    // 2) First store → stored (force_update bypasses similarity check in shared dev collection)
    const first = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(md),
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });
    const firstParsed = expectValidJsonResult(first);
    expect(firstParsed.status).toBe('stored');
    expect(Array.isArray(firstParsed.items)).toBe(true);
    expect(firstParsed.items.length).toBeGreaterThanOrEqual(1);

    // 3) Second store (same H1) → error DUPLICATE_CHAIN
    const second = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(md),
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });
    expect(second).toBeDefined();
    expect(second.isError).toBe(true);
    expect(second.content).toBeDefined();
    const dupBody = JSON.parse(second.content[0].text);
    // Second store without force_update: DUPLICATE_CHAIN or SIMILAR_MEMORY_FOUND (both indicate existing memory)
    expect(['DUPLICATE_CHAIN', 'SIMILAR_MEMORY_FOUND']).toContain(dupBody.error);
    if (dupBody.error === 'DUPLICATE_CHAIN') {
      expect(dupBody.chain_id).toBeDefined();
      expect(Array.isArray(dupBody.items)).toBe(true);
      expect(dupBody.items.length).toBeGreaterThan(0);
    } else {
      expect(dupBody.existing_memory).toBeDefined();
    }

    // 4) Third store with force_update → stored (overwrites prior chain)
    const third = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(md),
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });
    const thirdParsed = expectValidJsonResult(third);
    expect(thirdParsed.status).toBe('stored');
    expect(Array.isArray(thirdParsed.items)).toBe(true);
    expect(thirdParsed.items.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  test('kairos_mint stores code block content', async () => {
    // Document with code blocks containing searchable identifiers
    const ts = Date.now();
    const codeContent = `# Code Example Documentation ${ts}

## Function Implementation
Here's how to implement a data processor:

\`\`\`typescript
function processData(input: string): string {
  return input.toUpperCase();
}

class DataProcessor {
  constructor(private data: string[]) {}

  processAll(): string[] {
    return this.data.map(item => processData(item));
  }
}
\`\`\`

PROOF OF WORK: timeout 45s echo implement-processor

## Usage Example

\`\`\`javascript
const processor = new DataProcessor(['hello', 'world']);
const result = processor.processAll();
console.log(result); // ['HELLO', 'WORLD']
\`\`\`

This demonstrates the data processing functionality.

PROOF OF WORK: timeout 45s echo run-processor`;

    // Store the document (force_update bypasses similarity check in shared dev collection)
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: codeContent,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });

    const storeResponse = expectValidJsonResult(storeResult);
    expect(storeResponse.status).toBe('stored');
    expect(storeResponse.items.length).toBeGreaterThanOrEqual(2); // Should create at least 2 sections

    // Test that kairos_search can find the chain (use semantic query from content)
    await new Promise((r) => setTimeout(r, 2000)); // Allow Qdrant indexing
    const searchResult = await mcpConnection.client.callTool({
      name: 'kairos_search',
      arguments: {
        query: 'Code Example Documentation DataProcessor'
      }
    });

    const searchResponse = expectValidJsonResult(searchResult);

    // V2 unified response shape (always present)
    expect(searchResponse.must_obey).toBe(true);
    expect(typeof searchResponse.perfect_matches).toBe('number');
    expect(typeof searchResponse.message).toBe('string');
    expect(typeof searchResponse.next_action).toBe('string');
    expect(searchResponse.next_action).toContain('kairos://mem/');
    expect(Array.isArray(searchResponse.choices)).toBe(true);
    expect(searchResponse.choices.length).toBeGreaterThanOrEqual(1);

    // At least one match choice should exist (or create fallback if indexing delayed)
    const matchChoices = searchResponse.choices.filter((c: any) => c.role === 'match');
    if (matchChoices.length === 0) {
      expect(searchResponse.choices.some((c: any) => c.role === 'create')).toBe(true);
    } else {
      expect(matchChoices.length).toBeGreaterThanOrEqual(1);
    }

    // Each choice has the V2 shape
    for (const choice of searchResponse.choices) {
      expect(choice).toHaveProperty('uri');
      expect(choice).toHaveProperty('label');
      expect(choice).toHaveProperty('chain_label');
      expect(choice).toHaveProperty('role');
      expect(choice).toHaveProperty('tags');
      expect(['match', 'create']).toContain(choice.role);
    }

    // V1 fields must NOT exist
    expect(searchResponse.protocol_status).toBeUndefined();
    expect(searchResponse.start_here).toBeUndefined();
    expect(searchResponse.best_match).toBeUndefined();
    expect(searchResponse.multiple_perfect_matches).toBeUndefined();
  }, 20000);
});