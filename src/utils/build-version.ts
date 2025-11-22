/**
 * Simple build version helper for KAIROS MCP.
 *
 * Format (matches http-server.ts health check logic):
 *   v2.1.0-YYYY.MM.DD-HH:MM
 *
 * Computed once at process startup so it is stable
 * for the lifetime of the running server.
 */

const buildVersion: string = (() => {
  const now = new Date();
  return (
    'v2.1.0-' +
    now.getFullYear() + '.' +
    String(now.getMonth() + 1).padStart(2, '0') + '.' +
    String(now.getDate()).padStart(2, '0') + '-' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0')
  );
})();

export function getBuildVersion(): string {
  return buildVersion;
}

