/**
 * Lightweight structural validation for protocol markdown before minting.
 * Ensures required sections (Natural Language Triggers, Completion Rule) and at least one challenge block.
 */

import { findAllChallengeBlocks } from './chain-builder-proof.js';

export const CREATION_PROTOCOL_URI = 'kairos://mem/00000000-0000-0000-0000-000000002001';

export type ValidationResult = {
  valid: boolean;
  missing: string[];
  message: string;
};

const MISSING_TRIGGERS = 'natural_language_triggers';
const MISSING_COMPLETION_RULE = 'completion_rule';
const MISSING_H1 = 'h1_title';
const MISSING_CHALLENGE_BLOCK = 'challenge_block';

/**
 * Extract H1 and H2 headings from markdown, ignoring lines inside fenced code blocks.
 */
function extractHeadings(markdown: string): { h1: boolean; h2Titles: string[] } {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = '';
  let h1 = false;
  const h2Titles: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (!inFence) {
        inFence = true;
        fenceChar = trimmed.slice(0, 3);
      } else if (trimmed.startsWith(fenceChar) || trimmed === '```') {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    if (/^#\s+/.test(line) && !/^##\s+/.test(line)) {
      h1 = true;
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match && h2Match[1]) {
      h2Titles.push(h2Match[1].trim());
    }
  }

  return { h1, h2Titles };
}

/**
 * Validate protocol markdown structure before storeChain.
 * Returns { valid, missing, message } so kairos_mint can return a PROTOCOL_STRUCTURE_INVALID error with next_action.
 */
export function validateProtocolStructure(markdownDoc: string): ValidationResult {
  const missing: string[] = [];
  const { h1, h2Titles } = extractHeadings(markdownDoc);

  if (!h1) {
    missing.push(MISSING_H1);
  }

  const firstH2 = h2Titles[0] ?? '';
  const lastH2 = h2Titles[h2Titles.length - 1] ?? '';
  if (!/Natural Language Triggers/i.test(firstH2)) {
    missing.push(MISSING_TRIGGERS);
  }
  if (!/Completion Rule/i.test(lastH2)) {
    missing.push(MISSING_COMPLETION_RULE);
  }

  const challengeBlocks = findAllChallengeBlocks(markdownDoc);
  if (challengeBlocks.length === 0) {
    missing.push(MISSING_CHALLENGE_BLOCK);
  }

  const valid = missing.length === 0;
  let message: string;
  if (valid) {
    message = '';
  } else {
    const parts = missing.map(m => {
      if (m === MISSING_H1) return 'H1 title';
      if (m === MISSING_TRIGGERS) return 'Natural Language Triggers (first H2)';
      if (m === MISSING_COMPLETION_RULE) return 'Completion Rule (last H2)';
      if (m === MISSING_CHALLENGE_BLOCK) return 'at least one challenge block';
      return m;
    });
    message = `Protocol is missing required structure: ${parts.join(', ')}. Run the creation protocol for guided help.`;
  }

  return { valid, missing, message };
}
