import type { ProofOfWorkDefinition } from '../../types/memory.js';

/** Match the last fenced code block (```json or ```) at end of step body. Captures prefix (group 1) and block content (group 2). */
// Note: Requires \n before the fence, so only matches line-start blocks (aligns with line-start-only rule).
const TRAILING_JSON_BLOCK_REGEX = /([\s\S]*)\n```(?:json)?\s*\n([\s\S]*?)```\s*$/;

/** Match a single fenced ```json block (for finding all challenge blocks). Only ```json counts so we avoid matching other fences (e.g. ```typescript) or stray ```\n. */
const ANY_JSON_BLOCK_REGEX = /(^|\n)(```json\s*\n([\s\S]*?)```)/gm;

export interface ChallengeBlockMatch {
  /** Start index of the opening ``` in content. */
  start: number;
  /** End index (after closing ```) in content. */
  end: number;
  proof: ProofOfWorkDefinition;
}

/**
 * Find all PoW boundaries in content: each ```json block with {"challenge": ...}.
 * Steps are defined by these boundaries, not by H2 headings.
 */
export function findAllChallengeBlocks(content: string): ChallengeBlockMatch[] {
  const results: ChallengeBlockMatch[] = [];
  let match: RegExpExecArray | null;
  ANY_JSON_BLOCK_REGEX.lastIndex = 0;
  while ((match = ANY_JSON_BLOCK_REGEX.exec(content)) !== null) {
    // match[1] = (^|\n) - the line start prefix
    // match[2] = the full block (```...```)
    // match[3] = the block content (JSON)
    const blockContent = match[3]!.trim();
    let parsed: { challenge?: unknown };
    try {
      parsed = JSON.parse(blockContent) as { challenge?: unknown };
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.challenge || typeof parsed.challenge !== 'object') {
      continue;
    }
    const challenge = parsed.challenge as Record<string, unknown>;
    const required = typeof challenge['required'] === 'boolean' ? challenge['required'] : true;
    const proof: ProofOfWorkDefinition = { ...challenge, required } as ProofOfWorkDefinition;
    // Calculate start/end: start is the opening ``` position (after the line-start prefix)
    const lineStartPrefixLength = match[1]!.length;
    const blockStart = match.index! + lineStartPrefixLength;
    const blockLength = match[2]!.length;
    results.push({
      start: blockStart,
      end: blockStart + blockLength,
      proof
    });
  }
  return results;
}

/**
 * Try to parse a trailing ```json block containing {"challenge": ...}. Canonical format per workflow docs.
 * Uses the last code block in the content so steps with multiple example blocks (e.g. challenge type docs) still get a proof.
 * Returns the challenge object and cleaned content (without the block) if valid.
 */
function extractTrailingChallengeBlock(content: string): { cleaned: string; challenge: ProofOfWorkDefinition } | null {
  const match = content.match(TRAILING_JSON_BLOCK_REGEX);
  if (!match || !match[2]) return null;
  const blockContent = match[2].trim();
  let parsed: { challenge?: unknown };
  try {
    parsed = JSON.parse(blockContent) as { challenge?: unknown };
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.challenge || typeof parsed.challenge !== 'object') {
    return null;
  }
  const challenge = parsed.challenge as Record<string, unknown>;
  const required = typeof challenge['required'] === 'boolean' ? challenge['required'] : true;
  const proof: ProofOfWorkDefinition = { ...challenge, required } as ProofOfWorkDefinition;
  const prefixLen = (match[1]?.length ?? 0);
  const cleaned = content.slice(0, match.index! + prefixLen).trim();
  return { cleaned, challenge: proof };
}

export function extractProofOfWork(content: string): { cleaned: string; proof?: ProofOfWorkDefinition } {
  const fromBlock = extractTrailingChallengeBlock(content);
  if (fromBlock) {
    return { cleaned: fromBlock.cleaned, proof: fromBlock.challenge };
  }
  return { cleaned: content.trim() };
}

