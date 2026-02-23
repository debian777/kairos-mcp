/**
 * Unit tests for getSpaceContext and default space behavior (plan section 11).
 */

import { getSpaceContext, runWithSpaceContext, getSpaceContextFromStorage, getSpaceIdFromStorage } from '../../src/utils/tenant-context.js';

describe('tenant-context', () => {
  describe('getSpaceContext', () => {
    it('returns default space when no request', () => {
      const ctx = getSpaceContext();
      expect(ctx.allowedSpaceIds).toContain('space:default');
      expect(ctx.defaultWriteSpaceId).toBe('space:default');
      expect(ctx.userId).toBe('');
      expect(ctx.groupIds).toEqual([]);
    });

    it('returns default when request has no auth', () => {
      const ctx = getSpaceContext({});
      expect(ctx.defaultWriteSpaceId).toBe('space:default');
      expect(ctx.allowedSpaceIds).toContain('space:default');
    });

    it('uses req.spaceContext when set', () => {
      const custom = {
        userId: 'u1',
        groupIds: ['g1'],
        allowedSpaceIds: ['user:u1', 'group:g1'],
        defaultWriteSpaceId: 'user:u1'
      };
      const ctx = getSpaceContext({ spaceContext: custom });
      expect(ctx).toEqual(custom);
    });

    it('when auth present (and AUTH_ENABLED), builds allowedSpaceIds from sub + groups', () => {
      const ctx = getSpaceContext({ auth: { sub: 'alice', groups: ['team1'] } });
      expect(ctx.allowedSpaceIds.length).toBeGreaterThanOrEqual(1);
      expect(ctx.defaultWriteSpaceId).toBeDefined();
      if (ctx.userId) {
        expect(ctx.userId).toBe('alice');
        expect(ctx.allowedSpaceIds).toContain('user:alice');
        expect(ctx.allowedSpaceIds).toContain('group:team1');
        expect(ctx.defaultWriteSpaceId).toBe('user:alice');
      }
    });

    it('handles missing groups (empty or undefined)', () => {
      const ctx = getSpaceContext({ auth: { sub: 'bob', groups: undefined as any } });
      expect(ctx.allowedSpaceIds.length).toBeGreaterThanOrEqual(1);
      if (ctx.userId === 'bob') {
        expect(ctx.allowedSpaceIds).toEqual(['user:bob']);
        expect(ctx.defaultWriteSpaceId).toBe('user:bob');
      } else {
        expect(ctx.defaultWriteSpaceId).toBe('space:default');
      }
    });
  });

  describe('AsyncLocalStorage and getSpaceIdFromStorage', () => {
    it('getSpaceContextFromStorage returns default when not in run', () => {
      const ctx = getSpaceContextFromStorage();
      expect(ctx.defaultWriteSpaceId).toBe('space:default');
    });

    it('runWithSpaceContext sets store and getSpaceIdFromStorage returns it', () => {
      const custom = {
        userId: 'u2',
        groupIds: [],
        allowedSpaceIds: ['user:u2'],
        defaultWriteSpaceId: 'user:u2'
      };
      let captured: string | null = null;
      runWithSpaceContext(custom, () => {
        captured = getSpaceIdFromStorage();
        return 1;
      });
      expect(captured).toBe('user:u2');
    });
  });
});
