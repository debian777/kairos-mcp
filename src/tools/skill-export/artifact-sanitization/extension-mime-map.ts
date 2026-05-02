/**
 * Maps filename extension → MIME types that are considered consistent for export checks.
 * Keep aligned with artifact allowlists (e.g. `artifact-files.ts` scroll filter).
 */

/**
 * For each known extension, allowed normalized MIME types (lowercase).
 * Unknown extensions are not validated by the extension–MIME rule (other rules may apply later).
 */
export const EXTENSION_TO_ALLOWED_MIMES: Readonly<Record<string, readonly string[]>> = {
  '.py': ['text/x-python'],
  '.sh': ['text/x-shellscript'],
  '.bash': ['text/x-shellscript'],
  '.js': ['text/javascript'],
  '.mjs': ['text/javascript'],
  '.cjs': ['text/javascript'],
  '.pl': ['text/x-perl'],
  '.pm': ['text/x-perl'],
  '.toml': ['text/x-toml'],
  '.yaml': ['text/yaml'],
  '.yml': ['text/yaml'],
  '.txt': ['text/plain']
};

/** MIME types allowed when the basename has no extension (basename has no dot). */
export const NO_EXTENSION_ALLOWED_MIMES: readonly string[] = ['text/plain'];
