import { describe, expect, it } from '@jest/globals';
import { deriveSkillMetadata, stripLeadingFrontmatter } from '../../src/tools/skill-export/derive-metadata.js';

describe('deriveSkillMetadata', () => {
  it('uses frontmatter name, slug, and description when present', () => {
    const md = `---
name: my-skill
slug: my-skill
description: From YAML
---

# Ignored Title

Body here.`;
    const out = deriveSkillMetadata({
      protocolMarkdown: md,
      label: 'L',
      kairosUri: 'kairos://adapter/uuid'
    });
    expect(out.name).toBe('my-skill');
    expect(out.slug).toBe('my-skill');
    expect(out.description).toBe('From YAML');
  });

  it('falls back to first paragraph after H1 when no frontmatter description', () => {
    const md = `# Title Here

First para line one.
Second line still same paragraph.

## Next`;

    const out = deriveSkillMetadata({
      protocolMarkdown: md,
      label: 'Lab',
      kairosUri: 'kairos://adapter/uuid'
    });
    expect(out.description).toContain('First para');
    expect(out.slug.length).toBeGreaterThan(0);
  });

  it('preserves contract wording in source markdown (caller strips frontmatter for body)', () => {
    const md = `# X\n\n\`\`\`json\n{"contract":{}}\n\`\`\`\n`;
    const stripped = stripLeadingFrontmatter(md);
    expect(stripped).toContain('"contract"');
  });
});
