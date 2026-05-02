/**
 * Extensible artifact checks for skill export (and future call sites).
 * Add new rules by implementing {@link ArtifactSanitizationRule} and passing
 * them into {@link runArtifactSanitization}.
 */

import type { SkillExportDiagnostic } from '../types.js';

/** One stored artifact row as seen during export (path + declared MIME). */
export interface ArtifactSanitizationInput {
  /** Relative path inside the bundle, e.g. `artifacts/helper.py`. */
  relativePath: string;
  /** `content_type` from storage (Qdrant / memory). */
  declaredContentType: string;
}

/**
 * Pluggable rule: return none, one issue, or many. Rules must be pure (no I/O).
 * Use stable {@link SkillExportDiagnostic.code} values (e.g. `artifact_ext_mime_mismatch`).
 */
export interface ArtifactSanitizationRule {
  readonly id: string;
  evaluate(input: ArtifactSanitizationInput): SkillExportDiagnostic | SkillExportDiagnostic[] | null;
}
