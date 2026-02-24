import type { ProofOfWorkDefinition } from '../../types/memory.js';

/** Match the last fenced code block (```json or ```) at end of step body. Captures prefix (group 1) and block content (group 2). */
const TRAILING_JSON_BLOCK_REGEX = /([\s\S]*)\n```(?:json)?\s*\n([\s\S]*?)```\s*$/;

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

// Legacy PROOF OF WORK line format below; kept for backward compatibility.
// Allow "Proof of work" lines even when preceded by bullets or emphasis. Supports both "PROOF OF WORK:" and "**PROOF OF WORK:**" formats
export const PROOF_LINE_REGEX = /^(?:[*\-+>\u2022]\s*)?(?:\*\*)?\s*PROOF OF WORK:\s*(?:\*\*)?\s*(.+)$/im;

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

export function parseProofLine(line: string): { cmd: string; timeout_seconds: number } | null {
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

export function extractProofOfWork(content: string): { cleaned: string; proof?: ProofOfWorkDefinition } {
  // Prefer canonical JSON challenge block at end of step (workflow docs; round-trips with dump).
  const fromBlock = extractTrailingChallengeBlock(content);
  if (fromBlock) {
    return { cleaned: fromBlock.cleaned, proof: fromBlock.challenge };
  }

  // Legacy PROOF OF WORK line format; kept for backward compatibility.
  const lines = content.split(/\r?\n/);
  let proof: ProofOfWorkDefinition | undefined;
  const filtered: string[] = [];

  for (const line of lines) {
    if (!proof) {
      const parsed = parseProofLine(line);
      if (parsed) {
        proof = {
          type: 'shell',
          shell: {
            cmd: parsed.cmd,
            timeout_seconds: parsed.timeout_seconds
          },
          cmd: parsed.cmd,
          timeout_seconds: parsed.timeout_seconds,
          required: true
        };
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

