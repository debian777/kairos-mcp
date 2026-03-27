/**
 * Resolve human-oriented space input (train / activate / tune) to a canonical space_id.
 * Matches the train tool: "personal", group names, optional "Group: " prefix, or raw allowed IDs.
 */

import type { SpaceContext } from './tenant-context.js';
import { KAIROS_APP_SPACE_DISPLAY_NAME } from './space-display.js';

export type ResolveSpaceParamResult =
  | { ok: true; spaceId: string }
  | { ok: false; code: 'SPACE_NOT_FOUND' | 'SPACE_READ_ONLY'; message: string };

/**
 * Resolve optional space string from tool input into an allowed space id.
 * Empty / undefined / "personal" → default write space (typically personal).
 */
export function resolveSpaceParamForContext(
  ctx: SpaceContext,
  raw: string | undefined
): ResolveSpaceParamResult {
  if (raw === undefined || typeof raw !== 'string') {
    return { ok: false, code: 'SPACE_NOT_FOUND', message: 'Space parameter is required.' };
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    const spaceId = ctx.defaultWriteSpaceId || ctx.allowedSpaceIds[0] || '';
    if (!spaceId) {
      return { ok: false, code: 'SPACE_NOT_FOUND', message: 'No default space in context.' };
    }
    return { ok: true, spaceId };
  }

  const spaceParam = trimmed.toLowerCase();
  if (spaceParam === 'personal') {
    const spaceId = ctx.defaultWriteSpaceId || ctx.allowedSpaceIds[0] || '';
    if (!spaceId) {
      return { ok: false, code: 'SPACE_NOT_FOUND', message: 'No personal or default space in context.' };
    }
    return { ok: true, spaceId };
  }

  if (spaceParam === KAIROS_APP_SPACE_DISPLAY_NAME.toLowerCase()) {
    return {
      ok: false,
      code: 'SPACE_READ_ONLY',
      message: `Cannot use "${KAIROS_APP_SPACE_DISPLAY_NAME}" as a writable target; it is read-only. Use "personal" or a group name.`
    };
  }

  const groupName = trimmed.startsWith('Group: ') ? trimmed.slice(7).trim() : trimmed;
  const match = ctx.allowedSpaceIds.find((id) => {
    if (id === groupName || id === trimmed) return true;
    if (id.startsWith('group:') && id.split(':').pop() === groupName) return true;
    return false;
  });
  if (!match) {
    return {
      ok: false,
      code: 'SPACE_NOT_FOUND',
      message: `Group or space "${groupName}" not found in your allowed spaces.`
    };
  }
  return { ok: true, spaceId: match };
}
