/**
 * Unit tests for spaceIdToDisplayName (frontend: names, backend: ids).
 */

import { spaceIdToDisplayName, KAIROS_APP_SPACE_DISPLAY_NAME } from '../../src/utils/space-display.js';
import { KAIROS_APP_SPACE_ID } from '../../src/config.js';

describe('space-display', () => {
  describe('spaceIdToDisplayName', () => {
    it('maps app space to Kairos app', () => {
      expect(spaceIdToDisplayName(KAIROS_APP_SPACE_ID)).toBe(KAIROS_APP_SPACE_DISPLAY_NAME);
      expect(spaceIdToDisplayName('space:kairos-app')).toBe('Kairos app');
    });

    it('maps user:realm:sub to Personal', () => {
      expect(spaceIdToDisplayName('user:default:alice')).toBe('Personal');
      expect(spaceIdToDisplayName('user:myrealm:bob')).toBe('Personal');
    });

    it('maps group:realm:ref to Group: ref', () => {
      expect(spaceIdToDisplayName('group:default:team1')).toBe('Group: team1');
      expect(spaceIdToDisplayName('group:myrealm:admins')).toBe('Group: admins');
    });

    it('returns Unknown for empty or non-string', () => {
      expect(spaceIdToDisplayName('')).toBe('Unknown');
      expect(spaceIdToDisplayName(undefined as any)).toBe('Unknown');
    });

    it('returns space id for unknown space: prefix', () => {
      const id = 'space:custom-name';
      expect(spaceIdToDisplayName(id)).toBe('custom-name');
    });
  });
});
