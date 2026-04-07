/**
 * Regression: activate/search output schemas include per-choice slug (github.com/debian777/kairos-mcp#306).
 */

import { describe, expect, test } from '@jest/globals';
import { getAdapterSlugForSearchOutput } from '../../src/services/memory/memory-accessors.js';
import { activateOutputSchema } from '../../src/tools/activate_schema.js';
import { searchOutputSchema } from '../../src/tools/search_schema.js';

const SAMPLE_ADAPTER_URI = 'kairos://adapter/00000000-0000-0000-0000-000000000001';

describe('getAdapterSlugForSearchOutput', () => {
  test('trims and returns non-empty slug', () => {
    expect(getAdapterSlugForSearchOutput({ slug: '  my-adapter  ' })).toBe('my-adapter');
  });

  test('returns null for missing or blank slug', () => {
    expect(getAdapterSlugForSearchOutput({})).toBeNull();
    expect(getAdapterSlugForSearchOutput({ slug: '' })).toBeNull();
    expect(getAdapterSlugForSearchOutput({ slug: '   ' })).toBeNull();
  });
});

describe('searchOutputSchema slug field', () => {
  test('parses choices with slug null', () => {
    const r = searchOutputSchema.safeParse({
      must_obey: true,
      message: 'm',
      next_action: 'n',
      choices: [
        {
          uri: SAMPLE_ADAPTER_URI,
          label: 'l',
          adapter_name: 'a',
          score: 0.5,
          role: 'match',
          tags: [],
          next_action: 'x',
          adapter_version: '1.0.0',
          space_name: 'Personal',
          slug: null
        }
      ]
    });
    expect(r.success).toBe(true);
  });

  test('parses choices with slug string', () => {
    const r = searchOutputSchema.safeParse({
      must_obey: true,
      message: 'm',
      next_action: 'n',
      choices: [
        {
          uri: SAMPLE_ADAPTER_URI,
          label: 'l',
          adapter_name: 'a',
          score: 0.5,
          role: 'match',
          tags: [],
          next_action: 'x',
          adapter_version: '1.0.0',
          space_name: 'Personal',
          slug: 'my-slug'
        }
      ]
    });
    expect(r.success).toBe(true);
  });

  test('rejects choice object without slug', () => {
    const r = searchOutputSchema.safeParse({
      must_obey: true,
      message: 'm',
      next_action: 'n',
      choices: [
        {
          uri: SAMPLE_ADAPTER_URI,
          label: 'l',
          adapter_name: 'a',
          score: 0.5,
          role: 'match',
          tags: [],
          next_action: 'x',
          adapter_version: '1.0.0',
          space_name: 'Personal'
        }
      ]
    });
    expect(r.success).toBe(false);
  });
});

describe('activateOutputSchema slug field', () => {
  test('parses choices with slug', () => {
    const r = activateOutputSchema.safeParse({
      must_obey: true,
      message: 'm',
      next_action: 'n',
      query: 'q',
      choices: [
        {
          uri: SAMPLE_ADAPTER_URI,
          label: 'l',
          adapter_name: 'a',
          activation_score: 0.5,
          role: 'match',
          tags: [],
          next_action: 'x',
          adapter_version: '1.0.0',
          space_name: 'Personal',
          slug: 'route-slug'
        },
        {
          uri: 'kairos://adapter/00000000-0000-0000-0000-000000002002',
          label: 'refine',
          adapter_name: 'refine',
          activation_score: null,
          role: 'refine',
          tags: [],
          next_action: 'r',
          adapter_version: null,
          space_name: null,
          slug: null
        }
      ]
    });
    expect(r.success).toBe(true);
  });
});
