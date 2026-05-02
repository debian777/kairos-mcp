import path from 'node:path';

import type { ArtifactSanitizationInput, ArtifactSanitizationRule } from '../types.js';
import { EXTENSION_TO_ALLOWED_MIMES, NO_EXTENSION_ALLOWED_MIMES } from '../extension-mime-map.js';
import { normalizeMimeType } from '../normalize-mime.js';

/**
 * Warn when the filename extension does not match the declared `content_type`
 * according to {@link EXTENSION_TO_ALLOWED_MIMES}.
 */
export function createExtensionMimeConsistencyRule(): ArtifactSanitizationRule {
  return {
    id: 'extension_mime_consistency',
    evaluate(input: ArtifactSanitizationInput) {
      const base = path.basename(input.relativePath.replace(/\\/g, '/'));
      const ext = path.extname(base).toLowerCase();
      const mime = normalizeMimeType(input.declaredContentType);

      if (!ext) {
        if (!mime) {
          return {
            severity: 'warning',
            code: 'artifact_missing_mime',
            message: `Artifact "${base}" has no file extension and no declared content type.`
          };
        }
        if (!NO_EXTENSION_ALLOWED_MIMES.includes(mime)) {
          return {
            severity: 'warning',
            code: 'artifact_no_ext_mime',
            message: `Artifact "${base}" has no file extension but declared type "${mime}"; expected one of: ${NO_EXTENSION_ALLOWED_MIMES.join(', ')}.`
          };
        }
        return null;
      }

      const allowed = EXTENSION_TO_ALLOWED_MIMES[ext];
      if (!allowed) {
        return null;
      }

      if (!mime) {
        return {
          severity: 'warning',
          code: 'artifact_ext_missing_mime',
          message: `Artifact "${base}" has extension "${ext}" but no declared content type.`
        };
      }

      if (!allowed.includes(mime)) {
        return {
          severity: 'warning',
          code: 'artifact_ext_mime_mismatch',
          message: `Artifact "${base}" extension "${ext}" does not match declared type "${mime}" (expected one of: ${allowed.join(', ')}).`
        };
      }

      return null;
    }
  };
}
