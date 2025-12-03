import type { ProofOfWorkDefinition } from '../../types/memory.js';

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

export function extractProofOfWork(content: string): { cleaned: string; proof?: Omit<ProofOfWorkDefinition, 'required'> } {
  const lines = content.split(/\r?\n/);
  let proof: Omit<ProofOfWorkDefinition, 'required'> | undefined;
  const filtered: string[] = [];

  for (const line of lines) {
    if (!proof) {
      const parsed = parseProofLine(line);
      if (parsed) {
        // Convert parsed result to ProofOfWorkDefinition format
        proof = {
          type: 'shell',
          shell: {
            cmd: parsed.cmd,
            timeout_seconds: parsed.timeout_seconds
          },
          // Backward compatibility
          cmd: parsed.cmd,
          timeout_seconds: parsed.timeout_seconds
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

