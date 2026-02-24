/**
 * Human-readable names for space IDs. Frontend (tools, responses) uses names; backend uses ids.
 */

import { KAIROS_APP_SPACE_ID } from '../config.js';

/** Display label for the app space (embedded mem docs). */
export const KAIROS_APP_SPACE_DISPLAY_NAME = 'Kairos app';

/**
 * Map a space_id to a human-readable name for tool outputs and agent-facing responses.
 * user:realm:sub → "Personal"; group:realm:ref → "Group: ref"; space:kairos-app → "Kairos app".
 */
export function spaceIdToDisplayName(spaceId: string): string {
  if (!spaceId || typeof spaceId !== 'string') return 'Unknown';
  if (spaceId === KAIROS_APP_SPACE_ID) return KAIROS_APP_SPACE_DISPLAY_NAME;
  const parts = spaceId.split(':');
  if (parts[0] === 'user') return 'Personal';
  if (parts[0] === 'group' && parts.length >= 3) return `Group: ${parts[2]!}`;
  if (parts[0] === 'space' && parts.length >= 2) return parts.slice(1).join(':') || spaceId;
  return spaceId;
}
