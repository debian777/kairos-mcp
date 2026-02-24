import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * @typedef {Object} Memory
 * @property {string} memory_uuid
 * @property {string} label
 * @property {string[]} tags
 * @property {string} text
 * @property {string|null} previous_memory_uuid
 * @property {string|null} next_memory_uuid
 * @property {string} llm_model_id
 * @property {string} created_at
 */

/**
 * @typedef {Object} MarkdownStructure
 * @property {string|null} h1
 * @property {string[]} h2Items
 */

function parseMarkdownStructure(text) {
  const lines = text.split(/\r?\n/);
  let h1 = null;
  const h2Items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Find H1 header
    if (trimmed.startsWith('# ') && h1 === null) {
      h1 = trimmed.substring(2).trim();
    }
    // Find H2 headers
    else if (trimmed.startsWith('## ')) {
      h2Items.push(trimmed.substring(3).trim());
    }
  }

  return { h1, h2Items };
}

function parseMarkdownSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.trim().startsWith('## ')) {
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim()
        });
      }
      currentSection = {
        title: line.trim().substring(3).trim(),
        content: []
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n').trim()
    });
  }

  return sections;
}

function buildMemoryChainFromMarkdown(markdownDoc, llmModelId) {
  const structure = parseMarkdownStructure(markdownDoc);
  if (!structure.h1 || structure.h2Items.length === 0) {
    return [];
  }

  const sections = parseMarkdownSections(markdownDoc);
  const now = new Date().toISOString();

  // Deterministic UUID stubs for the test
  const uuids = sections.map((_, index) => `uuid-${index + 1}`);

  return sections.map((section, index) => {
    const memory_uuid = uuids[index];
    return {
      memory_uuid,
      label: `${structure.h1}: ${section.title}`.slice(0, 120),
      tags: [],
      text: section.content,
      previous_memory_uuid: index === 0 ? null : uuids[index - 1],
      next_memory_uuid: index === sections.length - 1 ? null : uuids[index + 1],
      llm_model_id: llmModelId,
      created_at: now
    };
  });
}

describe('Markdown header-based slicing into a memory chain', () => {
  test('single markdown file with H1 + H2 produces multiple memories', () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/knowledge-mining-game.md');
    const markdown = readFileSync(fixturePath, 'utf-8');

    const memories = buildMemoryChainFromMarkdown(markdown, 'mcp-unit-test-model');


    console.log('Memory chain from markdown:', memories);


    expect(memories.length).toBe(8);

    const first = memories[0];
    const last = memories[memories.length - 1];

    // First memory: no previous, has next
    expect(first.previous_memory_uuid).toBeNull();
    expect(first.next_memory_uuid).toBe(memories[1].memory_uuid);

    // Last memory: has previous, no next
    expect(last.previous_memory_uuid).toBe(memories[memories.length - 2].memory_uuid);
    expect(last.next_memory_uuid).toBeNull();

    // Middle memories (if any): both previous and next
    for (let i = 1; i < memories.length - 1; i++) {
      expect(memories[i].previous_memory_uuid).toBe(memories[i - 1].memory_uuid);
      expect(memories[i].next_memory_uuid).toBe(memories[i + 1].memory_uuid);
    }
  });
});
