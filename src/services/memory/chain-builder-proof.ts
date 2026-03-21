import type { InferenceContractDefinition } from '../../types/memory.js';

/** Match the last fenced code block (```json or ```) at end of step body. Captures prefix (group 1) and block content (group 2). */
// Note: Requires \n before the fence, so only matches line-start blocks (aligns with line-start-only rule).
const TRAILING_JSON_BLOCK_REGEX = /([\s\S]*)\n```(?:json)?\s*\n([\s\S]*?)```\s*$/;

/** Match a single fenced ```json block (for finding all challenge blocks). Only ```json counts so we avoid matching other fences (e.g. ```typescript) or stray ```\n. */
const ANY_JSON_BLOCK_REGEX = /(^|\n)(```json\s*\n([\s\S]*?)```)/gm;

/** Match plain ``` (no json) fenced blocks at line start. Used to reject mixed-fence docs. */
const ANY_PLAIN_FENCE_REGEX = /(^|\n)(```(?!json)\s*\n([\s\S]*?)```)/gm;

export interface ContractBlockMatch {
  /** Start index of the opening ``` in content. */
  start: number;
  /** End index (after closing ```) in content. */
  end: number;
  contract: InferenceContractDefinition;
}

/**
 * Parse a fenced JSON payload and return a normalized inference contract.
 * Current format prefers {"contract": ...}, but older {"challenge": ...} continues to
 * parse so existing stored content can be migrated offline without breaking
 * internal helpers during the refactor.
 */
function parseContractBlock(rawJson: string): InferenceContractDefinition | null {
  let parsed: { challenge?: unknown; contract?: unknown };
  try {
    parsed = JSON.parse(rawJson) as { challenge?: unknown; contract?: unknown };
  } catch {
    return null;
  }

  const source =
    parsed && typeof parsed === 'object' && parsed.contract && typeof parsed.contract === 'object'
      ? parsed.contract
      : parsed && typeof parsed === 'object' && parsed.challenge && typeof parsed.challenge === 'object'
        ? parsed.challenge
        : null;

  if (!source || typeof source !== 'object') {
    return null;
  }

  const contract = source as Record<string, unknown>;
  const required = typeof contract['required'] === 'boolean' ? contract['required'] : true;
  return { ...contract, required } as InferenceContractDefinition;
}

/**
 * Find all contract boundaries in content: each ```json block with
 * {"contract": ...} or older {"challenge": ...}. Layers are defined by these
 * boundaries, not by H2 headings.
 */
export function findAllContractBlocks(content: string): ContractBlockMatch[] {
  const results: ContractBlockMatch[] = [];
  let match: RegExpExecArray | null;
  ANY_JSON_BLOCK_REGEX.lastIndex = 0;
  while ((match = ANY_JSON_BLOCK_REGEX.exec(content)) !== null) {
    // match[1] = (^|\n) - the line start prefix
    // match[2] = the full block (```...```)
    // match[3] = the block content (JSON)
    const blockContent = match[3]!.trim();
    const contract = parseContractBlock(blockContent);
    if (!contract) {
      continue;
    }
    // Calculate start/end: start is the opening ``` position (after the line-start prefix)
    const lineStartPrefixLength = match[1]!.length;
    const blockStart = match.index! + lineStartPrefixLength;
    const blockLength = match[2]!.length;
    results.push({
      start: blockStart,
      end: blockStart + blockLength,
      contract
    });
  }
  return results;
}

/**
 * Returns true if the document has any plain ``` (no "json") fenced block whose
 * content is valid JSON with a "contract" or older "challenge" key. Such docs
 * would pass "at least one ```json contract" but layer parsing would ignore the
 * plain blocks, minting fewer layers than the doc implies.
 */
export function hasPlainFenceContractBlock(content: string): boolean {
  let match: RegExpExecArray | null;
  ANY_PLAIN_FENCE_REGEX.lastIndex = 0;
  while ((match = ANY_PLAIN_FENCE_REGEX.exec(content)) !== null) {
    const blockContent = match[3]!.trim();
    if (parseContractBlock(blockContent)) {
      return true;
    }
  }
  return false;
}

/**
 * Try to parse a trailing ```json block containing {"contract": ...} or older
 * {"challenge": ...}. Uses the last code block in the content so layers with
 * multiple example blocks still get a contract. Returns the contract object and
 * cleaned content (without the block) if valid.
 */
function extractTrailingContractBlock(content: string): { cleaned: string; contract: InferenceContractDefinition } | null {
  const match = content.match(TRAILING_JSON_BLOCK_REGEX);
  if (!match || !match[2]) return null;
  const blockContent = match[2].trim();
  const contract = parseContractBlock(blockContent);
  if (!contract) {
    return null;
  }
  const prefixLen = (match[1]?.length ?? 0);
  const cleaned = content.slice(0, match.index! + prefixLen).trim();
  return { cleaned, contract };
}

export function extractInferenceContract(content: string): { cleaned: string; contract?: InferenceContractDefinition } {
  const fromBlock = extractTrailingContractBlock(content);
  if (fromBlock) {
    return { cleaned: fromBlock.cleaned, contract: fromBlock.contract };
  }
  return { cleaned: content.trim() };
}

// Transitional aliases kept while the internal codebase moves to adapter-oriented naming.
