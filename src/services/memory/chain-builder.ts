import crypto from 'node:crypto';
import type { Memory } from '../../types/memory.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import {
  parseMarkdownStructure,
  generateTags,
} from '../../utils/memory-store-utils.js';
import { extractProofOfWork, findAllChallengeBlocks } from './chain-builder-proof.js';

/**
 * Sanitize H2 headings to remove STEP patterns and numbering that break chain order.
 * Transforms patterns like "## STEP 1 — Foo" or "## 3. Bar" into "## Foo" or "## Bar".
 */
function sanitizeHeading(line: string): string {
  if (!line.startsWith('## ')) return line;

  return line
    // Remove ALL forbidden STEP patterns
    .replace(/^##\s*STEP\s*\d+[:\s—–\-·•]*\s*/i, '## ')        // STEP 1, Step 2, step 9:
    .replace(/^##\s*\d+[\s\.\)\-:—–\-·•]*\s*/i, '## ')        // 1., 01 —, 2)
    .replace(/^##\s*[0-9]+[a-zA-Z]*[\s\.\)\-:—–\-·•]*\s*/i, '## ') // 1a), T1 —, Phase 3:
    .trim();
}

/**
 * Derive step label from segment text: first H2 (## Title) in the segment, or fallback.
 */
function stepLabelFromSegment(segmentText: string, chainLabel: string, stepIndex: number): string {
  const h2Match = segmentText.match(/^##\s+(.+)$/m);
  const title = h2Match?.[1];
  if (title) return title.trim();
  return chainLabel || `Step ${stepIndex + 1}`;
}

/**
 * Process a single H1 section into a chain of memories. Step boundaries are defined by
 * PoW (proof-of-work) only: each ```json block with {"challenge": ...} ends one step.
 * H2 headings are used only for step labels when present in a segment.
 */
function processH1Section(
  h1Title: string,
  h1Content: string,
  llmModelId: string,
  now: Date,
  codeBlockProcessor: CodeBlockProcessor
): Memory[] {
  const blocks = findAllChallengeBlocks(h1Content);

  // No PoW blocks: single memory (entire content, optional trailing challenge parsed by extractProofOfWork)
  if (blocks.length === 0) {
    const { cleaned, proof } = extractProofOfWork(h1Content);
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    const proofMetadata = proof
      ? { ...proof, required: proof.required ?? true }
      : undefined;
    const singleMemory: any = {
      memory_uuid: crypto.randomUUID(),
      label: stepLabelFromSegment(cleaned, h1Title, 0),
      tags: allTags,
      text: cleaned,
      llm_model_id: llmModelId,
      created_at: now.toISOString(),
      chain: {
        id: '',
        label: h1Title,
        step_index: 1,
        step_count: 1
      } as any
    };
    if (proofMetadata) singleMemory.proof_of_work = proofMetadata;
    return [singleMemory as Memory];
  }

  // One or more PoW blocks: steps are defined by each block; optional trailing segment after last block = final step (no proof)
  const nowIso = now.toISOString();
  const memories: Memory[] = [];
  let prevEnd = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    // Segment text = content from prevEnd up to (but not including) this block; block defines this step's proof
    const segmentText = h1Content.slice(prevEnd, block.start).trim();
    const cleaned = segmentText;
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    const proofMetadata = {
      ...block.proof,
      required: block.proof.required ?? true
    };
    memories.push({
      memory_uuid: crypto.randomUUID(),
      label: stepLabelFromSegment(cleaned, h1Title, i),
      tags: allTags,
      text: cleaned,
      llm_model_id: llmModelId,
      created_at: nowIso,
      chain: h1Title
        ? {
            id: '',
            label: h1Title,
            step_index: i + 1,
            step_count: blocks.length // may add +1 if there's trailing content
          }
        : undefined,
      proof_of_work: proofMetadata
    } as Memory);
    prevEnd = block.end;
  }

  // Trailing content after last block = final step (no proof required)
  const trailing = h1Content.slice(prevEnd).trim();
  if (trailing.length > 0) {
    const codeResult = codeBlockProcessor.processMarkdown(trailing);
    const baseTags = generateTags(trailing);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    const stepCount = memories.length + 1;
    memories.forEach(m => {
      if (m.chain) m.chain.step_count = stepCount;
    });
    memories.push({
      memory_uuid: crypto.randomUUID(),
      label: stepLabelFromSegment(trailing, h1Title, memories.length),
      tags: allTags,
      text: trailing,
      llm_model_id: llmModelId,
      created_at: nowIso,
      chain: h1Title
        ? {
            id: '',
            label: h1Title,
            step_index: stepCount,
            step_count: stepCount
          }
        : undefined
    } as Memory);
  } else {
    memories.forEach(m => {
      if (m.chain) m.chain.step_count = memories.length;
    });
  }

  return memories;
}

export function buildHeaderMemoryChain(markdownDoc: string, llmModelId: string, now: Date, codeBlockProcessor: CodeBlockProcessor): Memory[] {
  // Sanitize all headings before processing to ensure chain order is unbreakable
  const cleanMarkdown = markdownDoc
    .split(/\r?\n/)
    .map(line => sanitizeHeading(line))
    .join('\n');

  const lines = cleanMarkdown.split(/\r?\n/);
  
  // Find all H1 positions to split document into separate chains
  // Track code block state to avoid interpreting comments inside code blocks as headers
  const h1Positions: Array<{ index: number; title: string }> = [];
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    
    // Toggle code block state when encountering code block delimiters
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    
    // Only check for H1 headers when not inside a code block
    if (!inCodeBlock && trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      h1Positions.push({ index: i, title: trimmed.substring(2).trim() });
    }
  }

  // If no H1 found, check for H2-only structure (legacy behavior)
  if (h1Positions.length === 0) {
    const structure = parseMarkdownStructure(cleanMarkdown);
    if (structure.h2Items.length === 0) {
      // No H1, no H2 - return empty (no structure to process)
      return [];
    }
    // Process as single chain without H1 - use first H2 as chain label or empty
    const firstH2 = structure.h2Items[0] || '';
    return processH1Section(firstH2, cleanMarkdown, llmModelId, now, codeBlockProcessor);
  }

  // Split document by H1 headings - each H1 becomes a separate chain
  const allMemories: Memory[] = [];
  
  for (let i = 0; i < h1Positions.length; i++) {
    const h1Start = h1Positions[i]!.index;
    const h1End = i < h1Positions.length - 1 ? h1Positions[i + 1]!.index : lines.length;
    const h1Title = h1Positions[i]!.title;
    
    // Extract content for this H1 section (excluding the H1 line itself)
    const h1SectionLines = lines.slice(h1Start + 1, h1End);
    const h1Content = h1SectionLines.join('\n');
    
    // Process this H1 section as a separate chain (Option 2: proof-based slicing)
    const chainMemories = processH1Section(h1Title, h1Content, llmModelId, now, codeBlockProcessor);
    allMemories.push(...chainMemories);
  }
  return allMemories;
}