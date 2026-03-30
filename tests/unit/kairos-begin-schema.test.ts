import { forwardInputSchema } from '../../src/tools/forward_schema.js';

const ADAPTER_URI = 'kairos://adapter/00000000-0000-0000-0000-000000000001';
const ADAPTER_SLUG_URI = 'kairos://adapter/create-merge-request';
const LAYER_URI = 'kairos://layer/00000000-0000-0000-0000-000000000002';
const LAYER_WITH_EXEC = `${LAYER_URI}?execution_id=00000000-0000-0000-0000-000000000003`;

describe('forward input schema (entry pass without solution)', () => {
  test('requires uri', () => {
    const r = forwardInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  test('accepts adapter uri without solution', () => {
    const r = forwardInputSchema.safeParse({ uri: ADAPTER_URI });
    expect(r.success).toBe(true);
  });

  test('accepts adapter slug uri without solution', () => {
    const r = forwardInputSchema.safeParse({ uri: ADAPTER_SLUG_URI });
    expect(r.success).toBe(true);
  });

  test('accepts layer uri without solution', () => {
    const r = forwardInputSchema.safeParse({ uri: LAYER_URI });
    expect(r.success).toBe(true);
  });

  test('requires solution for layer uri with execution_id query', () => {
    const r = forwardInputSchema.safeParse({ uri: LAYER_WITH_EXEC });
    expect(r.success).toBe(false);
  });

  test('accepts layer uri with execution_id query when solution is provided', () => {
    const r = forwardInputSchema.safeParse({
      uri: LAYER_WITH_EXEC,
      solution: {
        type: 'comment',
        comment: { text: 'Continuing the same run with a valid comment solution.' }
      }
    });
    expect(r.success).toBe(true);
  });

  test('rejects solution when starting from adapter uri', () => {
    const r = forwardInputSchema.safeParse({
      uri: ADAPTER_URI,
      solution: {
        type: 'comment',
        comment: { text: 'should not be allowed on start' }
      }
    });
    expect(r.success).toBe(false);
  });

  test('rejects solution when starting from layer uri without execution_id', () => {
    const r = forwardInputSchema.safeParse({
      uri: LAYER_URI,
      solution: {
        type: 'comment',
        comment: { text: 'should not be allowed on start' }
      }
    });
    expect(r.success).toBe(false);
  });
});
