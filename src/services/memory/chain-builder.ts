import crypto from 'node:crypto';
import type { Memory, ProofOfWorkDefinition } from '../../types/memory.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import {
  parseMarkdownStructure,
  generateTags,
} from '../../utils/memory-store-utils.js';
import { parseProofLine, extractProofOfWork } from './chain-builder-proof.js';

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
 * Process a single H1 section into a chain of memories using Option 2 algorithm.
 * Slices by proof-of-work lines instead of H2 headers.
 * Each H1 becomes a chain label; proof-of-work lines define step boundaries.
 */
function processH1Section(
  h1Title: string,
  h1Content: string,
  llmModelId: string,
  now: Date,
  codeBlockProcessor: CodeBlockProcessor
): Memory[] {
  const lines = h1Content.split(/\r?\n/);
  
  // Option 2: Single-pass algorithm - slice by proof-of-work
  interface StepData {
    chain_label: string;
    step_label: string;
    markdown_doc: string[];
    proof_of_work?: { cmd: string; timeout_seconds: number };
  }
  
  const full_markdown: Record<number, StepData> = {};
  let step = 1;
  let pendingProof = false; // Track if we have a proof waiting for the next H2
  
  // Initialize first step
  full_markdown[step] = {
    chain_label: h1Title,
    step_label: '',
    markdown_doc: []
  };
  
  for (const raw of lines) {
    const line = raw; // preserve formatting
    const trimmed = line.trim();
    
    // Ensure current step exists
    if (!full_markdown[step]) {
      full_markdown[step] = {
        chain_label: h1Title,
        step_label: '',
        markdown_doc: []
      };
    }
    const currentStep = full_markdown[step]!;
    
    // H1 is already handled by caller, but check for safety
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      currentStep.chain_label = trimmed.substring(2).trim();
      continue;
    }
    
    // Check for proof-of-work line
    const proof = parseProofLine(line);
    if (proof) {
      currentStep.proof_of_work = proof;
      currentStep.markdown_doc.push(line); // Include proof line in content
      pendingProof = true; // Mark that we have a proof waiting for next H2
      continue;
    }
    
    // Check for H2 header
    if (trimmed.startsWith('## ')) {
      const h2Title = trimmed.substring(3).trim();
      // If we have a pending proof, this H2 starts the NEXT step
      if (pendingProof) {
        step += 1;
        // Initialize next step if it doesn't exist
        if (!full_markdown[step]) {
          full_markdown[step] = {
            chain_label: h1Title,
            step_label: '',
            markdown_doc: []
          };
        }
        pendingProof = false; // Clear the pending proof flag
      }
      // Get current step (may have changed)
      const stepForH2 = full_markdown[step]!;
      // Append H2 to current step's label (with separator if label exists)
      if (stepForH2.step_label) {
        stepForH2.step_label += ' / ' + h2Title;
      } else {
        stepForH2.step_label = h2Title;
      }
      continue;
    }
    
    // Regular content line
    currentStep.markdown_doc.push(line);
  }
  
  // After parsing: if step == 1 at end, single memory (no proof or proof at end)
  // If step > 1, multiple steps created by proofs
  // Filter out empty steps (step 2+ that were created but have no content)
  const steps = Object.keys(full_markdown)
    .map(Number)
    .sort((a, b) => a - b)
    .filter(stepNum => {
      const stepData = full_markdown[stepNum]!;
      // Keep step if it has content or if it's the only step
      return stepData.markdown_doc.length > 0 || stepNum === 1;
    });
  
  // If proof is at end, last step will be empty - remove it and treat as single memory
  if (steps.length > 1) {
    const lastStep = steps[steps.length - 1]!;
    const lastStepData = full_markdown[lastStep]!;
    // If last step has no content and no proof, it was created by proof at end
    if (lastStepData.markdown_doc.length === 0 && !lastStepData.proof_of_work) {
      steps.pop(); // Remove empty last step
    }
  }
  
  // If only step 1 exists (no proof or proof at end), return single memory
  if (steps.length === 1 && steps[0] === 1) {
    // Single memory case - return as-is
    const stepData = full_markdown[1]!;
    const content = stepData.markdown_doc.join('\n');
    const label = stepData.step_label || stepData.chain_label; // Fallback to chain_label if no H2
    
    const { cleaned } = extractProofOfWork(content);
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    
    return [{
      memory_uuid: crypto.randomUUID(),
      label,
      tags: allTags,
      text: cleaned,
      llm_model_id: llmModelId,
      created_at: now.toISOString(),
      chain: {
        id: '', // Will be set by store function
        label: stepData.chain_label,
        step_index: 1,
        step_count: 1
      } as any
    }];
  }
  
  // Multiple steps: require proof for all steps
  const nowIso = now.toISOString();
  const uuids = steps.map(() => crypto.randomUUID());
  
  return steps.map((stepNum, index) => {
    const stepData = full_markdown[stepNum]!;
    const content = stepData.markdown_doc.join('\n');
    const { cleaned, proof } = extractProofOfWork(content);
    
    // All steps must have proof, except the last step (which can be without proof)
    const isLastStep = index === steps.length - 1;
    if (!proof && steps.length > 1 && !isLastStep) {
      throw new Error(`Missing PROOF OF WORK line in step "${stepData.step_label || stepData.chain_label}"`);
    }
    
    const memory_uuid = uuids[index]!;
    const label = stepData.step_label || stepData.chain_label; // Fallback to chain_label if no H2
    
    // Process code blocks for enhanced searchability
    const codeResult = codeBlockProcessor.processMarkdown(cleaned);
    
    // Generate tags including code identifiers
    const baseTags = generateTags(cleaned);
    const codeTags = codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];
    
    let proofMetadata: ProofOfWorkDefinition | undefined;
    if (proof) {
      // Use shell object if available, otherwise fall back to backward-compatible fields
      const cmd = proof.shell?.cmd || proof.cmd || '';
      const timeout = proof.shell?.timeout_seconds || proof.timeout_seconds || 60;
      proofMetadata = {
        type: 'shell',
        shell: {
          cmd,
          timeout_seconds: timeout
        },
        required: true
      };
    }
    
    const obj: any = {
      memory_uuid,
      label,
      tags: allTags,
      text: cleaned,
      llm_model_id: llmModelId,
      created_at: nowIso
    };
    if (proofMetadata) {
      obj.proof_of_work = proofMetadata;
    }
    // Store chain label in chain object (id will be set by store function)
    if (h1Title) {
      obj.chain = {
        id: '', // Will be set by store function
        label: h1Title,
        step_index: index + 1,
        step_count: steps.length
      } as any;
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