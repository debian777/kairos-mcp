import { describe, expect, it } from '@jest/globals';
import { resolveSpaceParamForContext } from '../../src/utils/resolve-space-param.js';
import type { SpaceContext } from '../../src/utils/tenant-context.js';

function ctx(partial: Partial<SpaceContext> & Pick<SpaceContext, 'allowedSpaceIds' | 'defaultWriteSpaceId'>): SpaceContext {
  return {
    userId: 'u',
    groupIds: [],
    allowedSpaceIds: partial.allowedSpaceIds,
    defaultWriteSpaceId: partial.defaultWriteSpaceId,
    requestId: partial.requestId
  };
}

describe('resolveSpaceParamForContext', () => {
  it('maps personal to default write space', () => {
    const c = ctx({
      allowedSpaceIds: ['user:r:sub1', 'group:r:team'],
      defaultWriteSpaceId: 'user:r:sub1'
    });
    expect(resolveSpaceParamForContext(c, 'personal')).toEqual({ ok: true, spaceId: 'user:r:sub1' });
    expect(resolveSpaceParamForContext(c, 'Personal')).toEqual({ ok: true, spaceId: 'user:r:sub1' });
  });

  it('resolves group by short name', () => {
    const c = ctx({
      allowedSpaceIds: ['user:r:sub1', 'group:r:team'],
      defaultWriteSpaceId: 'user:r:sub1'
    });
    expect(resolveSpaceParamForContext(c, 'team')).toEqual({ ok: true, spaceId: 'group:r:team' });
    expect(resolveSpaceParamForContext(c, 'Group: team')).toEqual({ ok: true, spaceId: 'group:r:team' });
  });

  it('accepts raw space id when allowed', () => {
    const c = ctx({
      allowedSpaceIds: ['user:r:sub1', 'group:r:team'],
      defaultWriteSpaceId: 'user:r:sub1'
    });
    expect(resolveSpaceParamForContext(c, 'group:r:team')).toEqual({ ok: true, spaceId: 'group:r:team' });
  });

  it('rejects unknown group', () => {
    const c = ctx({
      allowedSpaceIds: ['user:r:sub1'],
      defaultWriteSpaceId: 'user:r:sub1'
    });
    const r = resolveSpaceParamForContext(c, 'nope');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SPACE_NOT_FOUND');
  });
});
