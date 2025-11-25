import crypto from 'node:crypto';
import type { Memory, ProofOfWorkDefinition } from '../../types/memory.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import {
  parseMarkdownStructure,
  generateTags,
} from '../../utils/memory-store-utils.js';

const PROOF_LINE_REGEX = /^PROOF OF WORK:\s*(.+)$/im;

function hasProofOfWork(markdownDoc: string): boolean {
  return PROOF_LINE_REGEX.test(markdownDoc);
}

function parseTimeout(token?: string | null): number {
  if (!token) return 60;
  const lower = token.toLowerCase();
  if (lower.endsWith('ms')) {
    const value = parseFloat(lower.replace(/ms$/, ''));
    return Number.isFinite(value) ? Math.max(1, Math.round(value / 1000)) : 60;
  }
  if (lower.endsWith('h')) {
    const value = parseFloat(lower.replace(/h$/, ''));
    return Number.isFinite(value) ? Math.max(1, Math.round(value * 3600)) : 60;
  }
  if (lower.endsWith('m')) {
    const value = parseFloat(lower.replace(/m$/, ''));
    return Number.isFinite(value) ? Math.max(1, Math.round(value * 60)) : 60;
  }
  if (lower.endsWith('s')) {
    const value = parseFloat(lower.replace(/s$/, ''));
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 60;
  }
  const asNumber = parseFloat(lower);
  return Number.isFinite(asNumber) ? Math.max(1, Math.round(asNumber)) : 60;
}

function parseProofLine(line: string): { cmd: string; timeout_seconds: number } | null {
  const match = line.trim().match(PROOF_LINE_REGEX);
  if (!match) {
    return null;
  }
  const remainder = (match[1] || '').trim();
  if (!remainder) {
    return null;
  }

  const timeoutMatch = remainder.match(/^timeout\s+([0-9]+[a-zA-Z]*)\s+(.*)$/i);
  if (timeoutMatch && timeoutMatch[2]) {
    const timeoutToken = timeoutMatch[1];
    const cmd = timeoutMatch[2].trim();
    if (!cmd) return null;
    return {
      cmd,
      timeout_seconds: parseTimeout(timeoutToken)
    };
  }

  return {
    cmd: remainder,
    timeout_seconds: 60
  };
}

function extractProofOfWork(content: string): { cleaned: string; proof?: Omit<ProofOfWorkDefinition, 'required'> } {
  const lines = content.split(/\r?\n/);
  let proof: Omit<ProofOfWorkDefinition, 'required'> | undefined;
  const filtered: string[] = [];

  for (const line of lines) {
    if (!proof) {
      const parsed = parseProofLine(line);
      if (parsed) {
        proof = parsed;
        continue;
      }
    }
    filtered.push(line);
  }

  const cleaned = filtered.join('\n').trim();
  if (proof) {
    return { cleaned, proof };
  }
  return { cleaned };
}

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
 * Process a single H1 section into a chain of memories.
 * Each H1 becomes a chain label; H2 sections within it become steps.
 */
function processH1Section(
  h1Title: string,
  h1Content: string,
  llmModelId: string,
  now: Date,
  codeBlockProcessor: CodeBlockProcessor,
  options: { proofMode?: boolean }
): Memory[] {
  const lines = h1Content.split(/\r?\n/);
  const sections: Array<{ title: string; content: string }> = [];

  let preambleActive = true;
  let preamble: string[] = [];
  let currentSection: { title: string; content: string[] } | null = null;

  for (const raw of lines) {
    const line = raw; // preserve formatting
    const trimmed = line.trim();

    // On encountering a new H2, finalize any preamble or previous section
    if (trimmed.startsWith('## ')) {
      // Finalize H1 preamble section if active and non-empty
      if (preambleActive) {
        const pre = preamble.join('\n');
        if (pre.trim().length > 0 && !options.proofMode) {
          sections.push({ title: h1Title, content: pre });
        }
        preambleActive = false;
        preamble = [];
      }

      // Finalize previous H2 section only if it has body
      if (currentSection) {
        const body = currentSection.content.join('\n');
        if (body.trim().length > 0) {
          sections.push({ title: currentSection.title, content: body });
        }
      }

      // Start a new H2 section
      currentSection = { title: trimmed.substring(3).trim(), content: [] };
      if (options.proofMode && preambleActive && preamble.length > 0) {
        currentSection.content.push(...preamble);
        preamble = [];
      }
      continue;
    }

    // Regular content lines
    if (preambleActive) {
      preamble.push(line);
    } else if (currentSection) {
      currentSection.content.push(line);
    } else {
      // After H1 but before any H2 appeared, keep collecting as preamble
      preambleActive = true;
      preamble.push(line);
    }
  }

  // End of section: finalize whichever collector is active
  if (currentSection) {
    const body = currentSection.content.join('\n');
    if (body.trim().length > 0) {
      sections.push({ title: currentSection.title, content: body });
    }
  } else if (preambleActive) {
    const pre = preamble.join('\n');
    if (pre.trim().length > 0 && !options.proofMode) {
      sections.push({ title: h1Title, content: pre });
    }
  }

  if (!sections.length) {
    return [];
  }

  const nowIso = now.toISOString();
  const uuids = sections.map(() => crypto.randomUUID());

  return sections.map((section, index) => {
    const { cleaned, proof } = extractProofOfWork(section.content);
    const proofRequired = !!options.proofMode && index >= 1;

    if (options.proofMode) {
      if (proofRequired && !proof) {
        throw new Error(`Missing PROOF OF WORK line in step "${section.title}"`);
      }
    }

    const memory_uuid = uuids[index]!;
    const label = section.title; // H1 for preamble, H2 for others

    // Process code blocks for enhanced searchability
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);

    // Generate tags including code identifiers
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5); // Limit to prevent tag explosion
    const allTags = [...baseTags, ...codeTags];

    const contentToStore = cleaned;
    let proofMetadata: ProofOfWorkDefinition | undefined;
    if (proof) {
      proofMetadata = {
        cmd: proof.cmd,
        timeout_seconds: proof.timeout_seconds,
        required: proofRequired
      };
    }

    const obj: any = {
      memory_uuid,
      label,
      tags: allTags,
      text: contentToStore,
      llm_model_id: llmModelId,
      created_at: nowIso
    };
    if (proofMetadata) {
      obj.proof_of_work = proofMetadata;
    }
    // Store chain label in chain object (only if H1 title is provided)
    // Note: step_index and step_count are required for chain detection in kairos_begin
    if (h1Title) {
      obj.chain = {
        label: h1Title,
        step_index: index + 1,
        step_count: sections.length
      };
    }
    return obj as Memory;
  });
}

export function buildHeaderMemoryChain(markdownDoc: string, llmModelId: string, now: Date, codeBlockProcessor: CodeBlockProcessor): Memory[] {
  // Sanitize all headings before processing to ensure chain order is unbreakable
  const cleanMarkdown = markdownDoc
    .split(/\r?\n/)
    .map(line => sanitizeHeading(line))
    .join('\n');
  const proofMode = hasProofOfWork(cleanMarkdown);
  if (!proofMode) {
    return [];
  }

  const lines = cleanMarkdown.split(/\r?\n/);
  
  // Find all H1 positions to split document into separate chains
  const h1Positions: Array<{ index: number; title: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      h1Positions.push({ index: i, title: trimmed.substring(2).trim() });
    }
  }

  // If no H1 found, check for H2-only structure (legacy behavior)
  if (h1Positions.length === 0) {
    const structure = parseMarkdownStructure(cleanMarkdown);
    if (structure.h2Items.length === 0) {
      return [];
    }
    // Process as single chain without H1 - use first H2 as chain label or empty
    const firstH2 = structure.h2Items[0] || '';
    return processH1Section(firstH2, cleanMarkdown, llmModelId, now, codeBlockProcessor, { proofMode: true });
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
    
    // Process this H1 section as a separate chain
    const chainMemories = processH1Section(h1Title, h1Content, llmModelId, now, codeBlockProcessor, { proofMode: true });
    allMemories.push(...chainMemories);
  }

  return allMemories;
}