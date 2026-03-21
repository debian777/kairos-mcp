import { buildBeginSchemas } from '../../src/tools/kairos_begin_schema.js';

const { inputSchema } = buildBeginSchemas();

describe('kairos_begin input schema', () => {
  test('requires uri or key', () => {
    const r = inputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  test('accepts uri only', () => {
    const r = inputSchema.safeParse({ uri: 'kairos://mem/00000000-0000-0000-0000-000000000001' });
    expect(r.success).toBe(true);
  });

  test('accepts key only', () => {
    const r = inputSchema.safeParse({ key: 'my-protocol-slug' });
    expect(r.success).toBe(true);
  });

  test('accepts both uri and key (uri wins at runtime)', () => {
    const r = inputSchema.safeParse({
      uri: 'kairos://mem/00000000-0000-0000-0000-000000000002',
      key: 'ignored'
    });
    expect(r.success).toBe(true);
  });
});
