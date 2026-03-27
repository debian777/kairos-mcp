import { describe, expect, it } from '@jest/globals';
import { trainInputSchema } from '../../src/tools/train_schema.js';

describe('trainInputSchema fork fields', () => {
  it('requires markdown_doc or source_adapter_uri', () => {
    const bad = trainInputSchema.safeParse({
      llm_model_id: 'm'
    });
    expect(bad.success).toBe(false);
  });

  it('accepts source_adapter_uri without markdown_doc', () => {
    const ok = trainInputSchema.safeParse({
      llm_model_id: 'm',
      source_adapter_uri: 'kairos://adapter/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    });
    expect(ok.success).toBe(true);
  });

  it('accepts markdown_doc only', () => {
    const ok = trainInputSchema.safeParse({
      llm_model_id: 'm',
      markdown_doc: '# T\n\n## Activation Patterns\n\n## Reward Signal\n\n```json\n{"contract":{}}\n```\n'
    });
    expect(ok.success).toBe(true);
  });
});
