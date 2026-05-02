/**
 * Deterministic, lightweight export diagnostics (not a security scanner).
 */

import type { SkillExportDiagnostic } from './types.js';

const RISKY = [
  { re: /\bcurl\s+[^|\n]*\|\s*(?:ba)?sh\b/i, code: 'SHELL_PIPE', message: 'Pipe-to-shell pattern in exported text' },
  { re: /\brm\s+(-[rf]+\s+)?\/\s/i, code: 'RM_ROOT', message: 'Suspicious rm pattern in exported text' }
];

/**
 * Scan assembled Markdown for simple risk hints (advisory only).
 */
export function scanMarkdownForDiagnostics(markdown: string): SkillExportDiagnostic[] {
  const out: SkillExportDiagnostic[] = [];
  for (const { re, code, message } of RISKY) {
    if (re.test(markdown)) {
      out.push({ severity: 'warning', code, message });
    }
  }
  return out;
}
