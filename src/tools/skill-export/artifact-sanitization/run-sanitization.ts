import type { ArtifactSanitizationInput, ArtifactSanitizationRule } from './types.js';
import type { SkillExportDiagnostic } from '../types.js';

function flatten(
  out: SkillExportDiagnostic[],
  rule: ArtifactSanitizationRule,
  input: ArtifactSanitizationInput
): void {
  const r = rule.evaluate(input);
  if (r == null) return;
  if (Array.isArray(r)) {
    for (const d of r) out.push(d);
    return;
  }
  out.push(r);
}

/**
 * Run all rules in order; diagnostics accumulate (same artifact may emit multiple codes).
 */
export function runArtifactSanitization(
  input: ArtifactSanitizationInput,
  rules: readonly ArtifactSanitizationRule[]
): SkillExportDiagnostic[] {
  const out: SkillExportDiagnostic[] = [];
  for (const rule of rules) {
    flatten(out, rule, input);
  }
  return out;
}
