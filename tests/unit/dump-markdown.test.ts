import { buildProtocolYamlFrontmatter, stripRedundantStepH2 } from '../../src/utils/dump-markdown.js';

describe('stripRedundantStepH2', () => {
  test('strips leading H2 matching label', () => {
    expect(stripRedundantStepH2('## Step A\n\nBody.', 'Step A')).toBe('Body.');
  });

  test('strips first matching H2 when prose precedes it (mint label from first ## in segment)', () => {
    const body = 'Read this first.\n\n## Do Thing\n\nThen act.';
    expect(stripRedundantStepH2(body, 'Do Thing')).toBe('Read this first.\n\nThen act.');
  });

  test('does not strip H2 inside fenced code block', () => {
    const body = '```markdown\n## Not Real\n```\n\n## Real\n\ntext';
    expect(stripRedundantStepH2(body, 'Real')).toBe('```markdown\n## Not Real\n```\n\ntext');
  });

  test('does not strip when label differs', () => {
    const body = '## Other\n\nBody';
    expect(stripRedundantStepH2(body, 'Mine')).toBe(body);
  });

  test('handles CRLF in input', () => {
    expect(stripRedundantStepH2('## T\r\n\r\nx', 'T')).toBe('x');
  });
});

describe('buildProtocolYamlFrontmatter', () => {
  test('includes slug and optional version', () => {
    expect(buildProtocolYamlFrontmatter('analyze-and-plan', '1.0.0')).toBe(
      '---\nslug: analyze-and-plan\nversion: 1.0.0\n---\n\n'
    );
  });

  test('omits version line when absent', () => {
    expect(buildProtocolYamlFrontmatter('foo')).toBe('---\nslug: foo\n---\n\n');
  });
});
