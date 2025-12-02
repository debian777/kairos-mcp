import { parseProofLine, extractProofOfWork, PROOF_LINE_REGEX } from '../../src/services/memory/chain-builder-proof.js';

describe('chain-builder-proof', () => {
  describe('parseProofLine', () => {
    test('parses standard PROOF OF WORK format', () => {
      const result = parseProofLine('PROOF OF WORK: echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('parses bolded PROOF OF WORK format', () => {
      const result = parseProofLine('**PROOF OF WORK:** echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('parses bolded PROOF OF WORK format with spaces after colon', () => {
      const result = parseProofLine('**PROOF OF WORK:**   echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('parses PROOF OF WORK with timeout', () => {
      const result = parseProofLine('PROOF OF WORK: timeout 30s echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 30
      });
    });

    test('parses bolded PROOF OF WORK with timeout', () => {
      const result = parseProofLine('**PROOF OF WORK:** timeout 45s echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 45
      });
    });

    test('parses PROOF OF WORK with bullet point', () => {
      const result = parseProofLine('- PROOF OF WORK: echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('parses bolded PROOF OF WORK with bullet point', () => {
      const result = parseProofLine('- **PROOF OF WORK:** echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('parses PROOF OF WORK with asterisk bullet', () => {
      const result = parseProofLine('* PROOF OF WORK: echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('parses bolded PROOF OF WORK with asterisk bullet', () => {
      const result = parseProofLine('* **PROOF OF WORK:** echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
    });

    test('returns null for invalid format', () => {
      const result = parseProofLine('Not a proof line');
      expect(result).toBeNull();
    });

    test('returns null for empty command', () => {
      const result = parseProofLine('PROOF OF WORK:');
      expect(result).toBeNull();
    });

    test('handles timeout with minutes', () => {
      const result = parseProofLine('**PROOF OF WORK:** timeout 5m echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 300
      });
    });

    test('handles timeout with hours', () => {
      const result = parseProofLine('**PROOF OF WORK:** timeout 1h echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 3600
      });
    });

    test('handles timeout with milliseconds', () => {
      const result = parseProofLine('**PROOF OF WORK:** timeout 5000ms echo test');
      expect(result).toEqual({
        cmd: 'echo test',
        timeout_seconds: 5
      });
    });
  });

  describe('extractProofOfWork', () => {
    test('extracts proof from content with standard format', () => {
      const content = `Some content here

PROOF OF WORK: echo test

More content`;
      const result = extractProofOfWork(content);
      expect(result.proof).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
      expect(result.cleaned).not.toContain('PROOF OF WORK:');
    });

    test('extracts proof from content with bolded format', () => {
      const content = `Some content here

**PROOF OF WORK:** echo test

More content`;
      const result = extractProofOfWork(content);
      expect(result.proof).toEqual({
        cmd: 'echo test',
        timeout_seconds: 60
      });
      expect(result.cleaned).not.toContain('**PROOF OF WORK:**');
    });

    test('extracts proof from content with bolded format and spaces', () => {
      const content = `Some content here

**PROOF OF WORK:**   timeout 30s echo test

More content`;
      const result = extractProofOfWork(content);
      expect(result.proof).toEqual({
        cmd: 'echo test',
        timeout_seconds: 30
      });
      expect(result.cleaned).not.toContain('**PROOF OF WORK:**');
    });

    test('returns cleaned content without proof when no proof exists', () => {
      const content = `Some content here

No proof of work line

More content`;
      const result = extractProofOfWork(content);
      expect(result.proof).toBeUndefined();
      expect(result.cleaned).toBe(content);
    });
  });

  describe('PROOF_LINE_REGEX', () => {
    test('matches standard format', () => {
      expect('PROOF OF WORK: echo test').toMatch(PROOF_LINE_REGEX);
    });

    test('matches bolded format', () => {
      expect('**PROOF OF WORK:** echo test').toMatch(PROOF_LINE_REGEX);
    });

    test('matches bolded format with spaces', () => {
      expect('**PROOF OF WORK:**   echo test').toMatch(PROOF_LINE_REGEX);
    });

    test('matches with bullet point', () => {
      expect('- PROOF OF WORK: echo test').toMatch(PROOF_LINE_REGEX);
      expect('- **PROOF OF WORK:** echo test').toMatch(PROOF_LINE_REGEX);
    });

    test('does not match invalid format', () => {
      expect('Not a proof line').not.toMatch(PROOF_LINE_REGEX);
      expect('PROOF OF WORK').not.toMatch(PROOF_LINE_REGEX);
    });
  });
});

