import { describe, expect, it } from '@jest/globals';
import {
  createDefaultArtifactSanitizationRules,
  createExtensionMimeConsistencyRule,
  runArtifactSanitization
} from '../../src/tools/skill-export/artifact-sanitization/index.js';

describe('artifact sanitization', () => {
  it('default rules include extension–MIME consistency', () => {
    const rules = createDefaultArtifactSanitizationRules();
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(rules.some((r) => r.id === 'extension_mime_consistency')).toBe(true);
  });

  it('accepts matching .py and text/x-python', () => {
    const d = runArtifactSanitization(
      { relativePath: 'artifacts/helper.py', declaredContentType: 'text/x-python' },
      [createExtensionMimeConsistencyRule()]
    );
    expect(d).toEqual([]);
  });

  it('warns on .py with wrong MIME', () => {
    const d = runArtifactSanitization(
      { relativePath: 'artifacts/helper.py', declaredContentType: 'text/javascript' },
      [createExtensionMimeConsistencyRule()]
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.code).toBe('artifact_ext_mime_mismatch');
    expect(d[0]?.severity).toBe('warning');
  });

  it('warns on extensionless name with non-plain MIME', () => {
    const d = runArtifactSanitization(
      { relativePath: 'artifacts/script', declaredContentType: 'text/x-python' },
      [createExtensionMimeConsistencyRule()]
    );
    expect(d.some((x) => x.code === 'artifact_no_ext_mime')).toBe(true);
  });

  it('accepts extensionless name with text/plain', () => {
    const d = runArtifactSanitization(
      { relativePath: 'artifacts/notes', declaredContentType: 'text/plain' },
      [createExtensionMimeConsistencyRule()]
    );
    expect(d).toEqual([]);
  });

  it('ignores unknown extension for this rule (no false positive)', () => {
    const d = runArtifactSanitization(
      { relativePath: 'artifacts/foo.rs', declaredContentType: 'text/plain' },
      [createExtensionMimeConsistencyRule()]
    );
    expect(d).toEqual([]);
  });
});
