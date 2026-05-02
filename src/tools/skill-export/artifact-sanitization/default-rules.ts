import type { ArtifactSanitizationRule } from './types.js';
import { createExtensionMimeConsistencyRule } from './rules/extension-mime-consistency.js';

/** Default pipeline for skill export; callers may append or replace rules. */
export function createDefaultArtifactSanitizationRules(): ArtifactSanitizationRule[] {
  return [createExtensionMimeConsistencyRule()];
}
