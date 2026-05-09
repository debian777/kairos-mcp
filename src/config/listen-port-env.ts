/** Default HTTP listen port when `PORT` is unset (matches `scripts/deploy-run-env.sh` dev default). */
const DEFAULT_APP_HTTP_PORT = 3300;

/**
 * Parsed `PORT`: a fixed TCP port, or `AUTO` (case-insensitive) to bind an ephemeral free port (OS-assigned).
 * Invalid values fail fast at module load so misconfiguration is not silently coerced.
 */
function parseAppHttpListenPort(): number | 'auto' {
  const raw = process.env['PORT'];
  if (raw === undefined || String(raw).trim() === '') {
    return DEFAULT_APP_HTTP_PORT;
  }
  const s = String(raw).trim();
  if (s.toLowerCase() === 'auto') {
    return 'auto';
  }
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    throw new Error(
      `Invalid PORT="${raw}". Use an integer 1-65535, omit for default (${DEFAULT_APP_HTTP_PORT}), or PORT=AUTO for an OS-assigned free port.`
    );
  }
  return n;
}

/** Listen target: fixed port number or automatic ephemeral assignment. */
export const APP_LISTEN_PORT_SPEC: number | 'auto' = parseAppHttpListenPort();
