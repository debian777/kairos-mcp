import crypto from 'node:crypto';
import type { Memory } from '../../types/memory.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import {
  parseMarkdownStructure,
  generateTags,
} from '../../utils/memory-store-utils.js';
import { extractInferenceContract, findAllContractBlocks } from './chain-builder-proof.js';

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
 * Derive layer label from segment text: first H2 (## Title) in the segment, or fallback.
 */
function stepLabelFromSegment(segmentText: string, chainLabel: string, stepIndex: number): string {
  const h2Match = segmentText.match(/^##\s+(.+)$/m);
  const title = h2Match?.[1];
  if (title) return title.trim();
  return chainLabel || `Layer ${stepIndex + 1}`;
}

function extractActivationPatterns(sectionText: string): string[] {
  const lines = sectionText.split(/\r?\n/);
  let collecting = false;
  const collected: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+(Activation Patterns|Natural Language Triggers)\s*$/i.test(trimmed)) {
      collecting = true;
      continue;
    }
    if (collecting && /^##\s+/.test(trimmed)) {
      break;
    }
    if (collecting) {
      collected.push(line);
    }
  }

  return collected
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Process a single H1 section into an adapter of layer memories. Layer
 * boundaries are defined by fenced contract blocks. H2 headings are used only
 * for layer labels when present in a segment.
 */
function processH1Section(
  h1Title: string,
  h1Content: string,
  llmModelId: string,
  now: Date,
  codeBlockProcessor: CodeBlockProcessor
): Memory[] {
  const blocks = findAllContractBlocks(h1Content);
  const activationPatterns = extractActivationPatterns(h1Content);

  // No contract blocks: single layer (entire content, optional trailing contract parsed by extractInferenceContract)
  if (blocks.length === 0) {
    const { cleaned, contract } = extractInferenceContract(h1Content);
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    const inferenceContract = contract
      ? { ...contract, required: contract.required ?? true }
      : undefined;
    const adapter: NonNullable<Memory['adapter']> = {
      id: '',
      name: h1Title,
      layer_index: 1,
      layer_count: 1,
      ...(activationPatterns.length > 0 && { activation_patterns: activationPatterns })
    };
    const singleMemory: any = {
      memory_uuid: crypto.randomUUID(),
      label: stepLabelFromSegment(cleaned, h1Title, 0),
      tags: allTags,
      text: cleaned,
      llm_model_id: llmModelId,
      created_at: now.toISOString(),
      activation_patterns: activationPatterns,
      adapter,
      chain: {
        id: adapter.id,
        label: adapter.name,
        step_index: adapter.layer_index,
        step_count: adapter.layer_count,
        ...(adapter.activation_patterns && { activation_patterns: adapter.activation_patterns })
      } as any
    };
    if (inferenceContract) {
      singleMemory.inference_contract = inferenceContract;
      singleMemory.proof_of_work = inferenceContract;
    }
    return [singleMemory as Memory];
  }

  // One or more contract blocks: layers are defined by each block; optional trailing
  // segment after last block = final layer (no explicit contract).
  const nowIso = now.toISOString();
  const memories: Memory[] = [];
  let prevEnd = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    // Segment text = content from prevEnd up to (but not including) this block;
    // block defines this layer's contract.
    const segmentText = h1Content.slice(prevEnd, block.start).trim();
    const cleaned = segmentText;
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    const inferenceContract = {
      ...block.contract,
      required: block.contract.required ?? true
    };
    const adapter: NonNullable<Memory['adapter']> = h1Title
      ? {
          id: '',
          name: h1Title,
          layer_index: i + 1,
          layer_count: blocks.length,
          ...(activationPatterns.length > 0 && { activation_patterns: activationPatterns })
        }
      : {
          id: '',
          name: `Adapter ${i + 1}`,
          layer_index: i + 1,
          layer_count: blocks.length,
          ...(activationPatterns.length > 0 && { activation_patterns: activationPatterns })
        };
    memories.push({
      memory_uuid: crypto.randomUUID(),
      label: stepLabelFromSegment(cleaned, h1Title, i),
      tags: allTags,
      text: cleaned,
      llm_model_id: llmModelId,
      created_at: nowIso,
      activation_patterns: activationPatterns,
      adapter,
      chain: h1Title
        ? {
            id: adapter.id,
            label: adapter.name,
            step_index: adapter.layer_index,
            step_count: adapter.layer_count,
            ...(adapter.activation_patterns && { activation_patterns: adapter.activation_patterns })
          }
        : undefined,
      inference_contract: inferenceContract,
      proof_of_work: inferenceContract
    } as Memory);
    prevEnd = block.end;
  }

  // Trailing content after last block = final layer (no contract required).
  const trailing = h1Content.slice(prevEnd).trim();
  if (trailing.length > 0) {
    const codeResult = codeBlockProcessor.processMarkdown(trailing);
    const baseTags = generateTags(trailing);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    const stepCount = memories.length + 1;
    memories.forEach(m => {
      if (m.adapter) m.adapter.layer_count = stepCount;
      if (m.chain) m.chain.step_count = stepCount;
    });
    const adapter: NonNullable<Memory['adapter']> = h1Title
      ? {
          id: '',
          name: h1Title,
          layer_index: stepCount,
          layer_count: stepCount,
          ...(activationPatterns.length > 0 && { activation_patterns: activationPatterns })
        }
      : {
          id: '',
          name: `Adapter ${stepCount}`,
          layer_index: stepCount,
          layer_count: stepCount,
          ...(activationPatterns.length > 0 && { activation_patterns: activationPatterns })
        };
    memories.push({
      memory_uuid: crypto.randomUUID(),
      label: stepLabelFromSegment(trailing, h1Title, memories.length),
      tags: allTags,
      text: trailing,
      llm_model_id: llmModelId,
      created_at: nowIso,
      activation_patterns: activationPatterns,
      adapter,
      chain: h1Title
        ? {
            id: adapter.id,
            label: adapter.name,
            step_index: adapter.layer_index,
            step_count: adapter.layer_count,
            ...(adapter.activation_patterns && { activation_patterns: adapter.activation_patterns })
          }
        : undefined
    } as Memory);
  } else {
    memories.forEach(m => {
      if (m.adapter) m.adapter.layer_count = memories.length;
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