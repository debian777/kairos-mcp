import crypto from 'node:crypto';
import type { Memory } from '../../types/memory.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import {
  parseMarkdownStructure,
  generateTags,
} from '../../utils/memory-store-utils.js';

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
  codeBlockProcessor: CodeBlockProcessor
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
        const pre = preamble.join('\n').trim();
        if (pre.length > 0) {
          sections.push({ title: h1Title, content: pre });
        }
        preambleActive = false;
        preamble = [];
      }

      // Finalize previous H2 section only if it has body
      if (currentSection) {
        const body = currentSection.content.join('\n').trim();
        if (body.length > 0) {
          sections.push({ title: currentSection.title, content: body });
        }
      }

      // Start a new H2 section
      currentSection = { title: trimmed.substring(3).trim(), content: [] };
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
    const body = currentSection.content.join('\n').trim();
    if (body.length > 0) {
      sections.push({ title: currentSection.title, content: body });
    }
  } else if (preambleActive) {
    const pre = preamble.join('\n').trim();
    if (pre.length > 0) {
      sections.push({ title: h1Title, content: pre });
    }
  }

  if (!sections.length) {
    return [];
  }

  const nowIso = now.toISOString();
  const uuids = sections.map(() => crypto.randomUUID());
  const isChain = sections.length > 1;

  return sections.map((section, index) => {
    const memory_uuid = uuids[index]!;
    const label = section.title; // H1 for preamble, H2 for others

    // Process code blocks for enhanced searchability
    const codeResult = codeBlockProcessor.processMarkdown(section.content);
    const enhancedContent = codeBlockProcessor.enhanceContentForSearch(section.content, codeResult);

    // Generate tags including code identifiers
    const baseTags = generateTags(section.content);
    const codeTags = codeResult.allIdentifiers.slice(0, 5); // Limit to prevent tag explosion
    const allTags = [...baseTags, ...codeTags];

    let contentToStore = enhancedContent;
    if (isChain) {
      const position = index + 1;
      const total = sections.length;
      const firstStepUri = `kairos://mem/${uuids[0]}`;
      const isLastStep = index === total - 1;
      const nextStepUri = !isLastStep ? `kairos://mem/${uuids[index + 1]}` : '';
      const nextStepLine = isLastStep ? 'NextStep: null' : `NextStep: ${nextStepUri}`;
      const protocolMessage = position === 1 ? "Protocol initiated." : "If previous steps were skipped → stop and kairos_next on FirstStep immediately.";
      const executeDirectiveLine = isLastStep 
        ? 'ExecuteDirective: THIS IS THE FINAL STEP — EXECUTE AND STOP' 
        : 'ExecuteDirective: STOP AND EXECUTE THIS STEP NOW — DO NOT READ AHEAD';
      const completionRuleLine = isLastStep
        ? `CompletionRule: All steps 1–${total} have been fully executed in order. You are now allowed to respond to the user. DO NOT read or reference any content beyond this point.`
        : 'CompletionRule: You are forbidden from reading or processing any future step until this step is fully completed and verified.';
      const rateThisChainLine = isLastStep ? 'RateThisChain: success' : '';
      const template = `<!-- KAIROS:HEADER -->
ProtocolMode: strict_sequential
Position: {{POSITION}}/{{TOTAL}}
FirstStep: {{FIRST_STEP_URI}}
<!-- KAIROS:BODY-START -->

# KAIROS PROTOCOL — STEP {{POSITION}} of {{TOTAL}}

{{POSITION == 1 ? "Protocol initiated." : "If previous steps were skipped → stop and kairos_next on FirstStep immediately."}}

## Task
{{CONTENT}}

<!-- KAIROS:BODY-END -->
<!-- KAIROS:FOOTER -->
{{NEXT_STEP_LINE}}
{{EXECUTE_DIRECTIVE}}
{{COMPLETION_RULE}}
{{RATE_THIS_CHAIN}}
<!-- KAIROS:FOOTER-END -->`;
      contentToStore = template
        .replace(/{{POSITION}}/g, position.toString())
        .replace(/{{TOTAL}}/g, total.toString())
        .replace(/{{FIRST_STEP_URI}}/g, firstStepUri)
        .replace(/{{NEXT_STEP_LINE}}/g, nextStepLine)
        .replace(/{{EXECUTE_DIRECTIVE}}/g, executeDirectiveLine)
        .replace(/{{COMPLETION_RULE}}/g, completionRuleLine)
        .replace(/{{RATE_THIS_CHAIN}}/g, rateThisChainLine)
        .replace(/{{CONTENT}}/g, section.content)
        .replace(/{{POSITION == 1 \? "Protocol initiated\." : "If previous steps were skipped → stop and kairos_next on FirstStep immediately\."}}/g, protocolMessage);
    }

    const obj: any = {
      memory_uuid,
      label,
      tags: allTags,
      text: contentToStore,
      llm_model_id: llmModelId,
      created_at: nowIso
    };
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
    
    // Process this H1 section as a separate chain
    const chainMemories = processH1Section(h1Title, h1Content, llmModelId, now, codeBlockProcessor);
    allMemories.push(...chainMemories);
  }

  return allMemories;
}