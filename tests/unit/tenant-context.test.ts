/**
 * Unit tests for getSpaceContext and default space behavior (plan section 11).
 * When AUTH_ENABLED=true, default space is disabled for strict isolation (no-default context).
 */

import { jest } from '@jest/globals';
import { getSpaceContext, runWithSpaceContext, runWithSpaceContextAsync, getSpaceContextFromStorage, getSpaceIdFromStorage, getSearchSpaceIds } from '../../src/utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../../src/config.js';

describe('tenant-context', () => {
  describe('getSpaceContext (AUTH_ENABLED from env)', () => {
    it('returns default space when no request and AUTH disabled', () => {
      const ctx = getSpaceContext();
      expect(ctx.userId).toBe('');
      expect(ctx.groupIds).toEqual([]);
      // When AUTH_ENABLED=false: default space is used
      if (ctx.defaultWriteSpaceId === 'space:default' || ctx.allowedSpaceIds.includes('space:default')) {
        expect(ctx.allowedSpaceIds).toContain(ctx.defaultWriteSpaceId);
        return;
      }
      // When AUTH_ENABLED=true: no-default context (strict isolation)
      expect(ctx.defaultWriteSpaceId).toBe('space:no-auth');
      expect(ctx.allowedSpaceIds).toEqual([]);
    });

    it('returns default or no-default when request has no auth depending on AUTH_ENABLED', () => {
      const ctx = getSpaceContext({});
      if (ctx.defaultWriteSpaceId === 'space:no-auth') {
        expect(ctx.allowedSpaceIds).toEqual([]);
      } else {
        expect(ctx.defaultWriteSpaceId).toBe('space:default');
        expect(ctx.allowedSpaceIds).toContain('space:default');
      }
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
        const realm = ctx.allowedSpaceIds[0]?.startsWith('user:') ? ctx.allowedSpaceIds[0].split(':')[1] : 'default';
        expect(ctx.allowedSpaceIds).toContain(`user:${realm}:alice`);
        expect(ctx.allowedSpaceIds).toContain(`group:${realm}:team1`);
        expect(ctx.defaultWriteSpaceId).toBe(`user:${realm}:alice`);
      }
    });

    it('handles missing groups (empty or undefined)', () => {
      const ctx = getSpaceContext({ auth: { sub: 'bob', groups: undefined as any } });
      expect(ctx.allowedSpaceIds.length).toBeGreaterThanOrEqual(1);
      if (ctx.userId === 'bob') {
        const realm = ctx.allowedSpaceIds[0]?.startsWith('user:') ? ctx.allowedSpaceIds[0].split(':')[1] : 'default';
        expect(ctx.allowedSpaceIds).toEqual([`user:${realm}:bob`]);
        expect(ctx.defaultWriteSpaceId).toBe(`user:${realm}:bob`);
      } else {
        expect(ctx.defaultWriteSpaceId).toBe('space:default');
      }
    });
  });

  describe('AsyncLocalStorage and getSpaceIdFromStorage', () => {
    it('getSpaceContextFromStorage returns default or no-auth when not in run', () => {
      const ctx = getSpaceContextFromStorage();
      if (ctx.defaultWriteSpaceId === 'space:no-auth') {
        expect(ctx.allowedSpaceIds).toEqual([]);
      } else {
        expect(ctx.defaultWriteSpaceId).toBe('space:default');
      }
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

    it('getSearchSpaceIds returns allowedSpaceIds plus app space (deduped)', () => {
      const ids = getSearchSpaceIds();
      expect(ids).toContain(KAIROS_APP_SPACE_ID);
      expect(ids.filter((id) => id === KAIROS_APP_SPACE_ID).length).toBe(1);
      const ctx = getSpaceContextFromStorage();
      ctx.allowedSpaceIds.forEach((id) => expect(ids).toContain(id));
    });

    it('getSearchSpaceIds when context has app space already includes it once', () => {
      const withApp = {
        userId: 'u',
        groupIds: [] as string[],
        allowedSpaceIds: [KAIROS_APP_SPACE_ID, 'user:realm:u'],
        defaultWriteSpaceId: 'user:realm:u'
      };
      const ids = runWithSpaceContext(withApp, () => getSearchSpaceIds());
      expect(ids.filter((id) => id === KAIROS_APP_SPACE_ID).length).toBe(1);
      expect(ids).toContain(KAIROS_APP_SPACE_ID);
      expect(ids).toContain('user:realm:u');
    });

    it('runWithSpaceContextAsync preserves context across await', async () => {
      const appCtx = {
        userId: '',
        groupIds: [] as string[],
        allowedSpaceIds: ['space:app'],
        defaultWriteSpaceId: 'space:app'
      };
      const spaceIdAfterAwait = await runWithSpaceContextAsync(appCtx, async () => {
        expect(getSpaceIdFromStorage()).toBe('space:app');
        await Promise.resolve();
        return getSpaceIdFromStorage();
      });
      expect(spaceIdAfterAwait).toBe('space:app');
    });
  });

  describe('when AUTH_ENABLED is true (strict isolation)', () => {
    let getSpaceContextWithAuth: typeof getSpaceContext;
    let getSpaceContextFromStorageWithAuth: typeof getSpaceContextFromStorage;
    let NO_AUTH_SPACE_ID: string;

    beforeAll(() => {
      jest.resetModules();
      jest.doMock('../../src/config.js', () => ({ AUTH_ENABLED: true, KAIROS_APP_SPACE_ID: 'space:kairos-app' }));
      const tenantContext = require('../../src/utils/tenant-context.js');
      getSpaceContextWithAuth = tenantContext.getSpaceContext;
      getSpaceContextFromStorageWithAuth = tenantContext.getSpaceContextFromStorage;
      NO_AUTH_SPACE_ID = tenantContext.NO_AUTH_SPACE_ID;
    });

    it('returns no-default context when no request', () => {
      const ctx = getSpaceContextWithAuth();
      expect(ctx.defaultWriteSpaceId).toBe(NO_AUTH_SPACE_ID);
      expect(ctx.allowedSpaceIds).toEqual([]);
      expect(ctx.userId).toBe('');
      expect(ctx.groupIds).toEqual([]);
    });

    it('returns no-default context when request has no auth', () => {
      const ctx = getSpaceContextWithAuth({});
      expect(ctx.defaultWriteSpaceId).toBe(NO_AUTH_SPACE_ID);
      expect(ctx.allowedSpaceIds).toEqual([]);
    });

    it('getSpaceContextFromStorage returns no-default when not in run', () => {
      const ctx = getSpaceContextFromStorageWithAuth();
      expect(ctx.defaultWriteSpaceId).toBe(NO_AUTH_SPACE_ID);
      expect(ctx.allowedSpaceIds).toEqual([]);
    });

    it('still returns auth-derived context when auth present', () => {
      const ctx = getSpaceContextWithAuth({ auth: { sub: 'alice', groups: ['team1'] } });
      expect(ctx.userId).toBe('alice');
      expect(ctx.defaultWriteSpaceId).toBe('user:default:alice');
      expect(ctx.allowedSpaceIds).toContain('user:default:alice');
      expect(ctx.allowedSpaceIds).toContain('group:default:team1');
    });
  });
});
