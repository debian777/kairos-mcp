/**
 * Env-driven limits for adapter Markdown / artifact size (train, tune, update).
 * Kept out of `config.ts` to satisfy max-lines.
 */

function readEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function readEnvFloat(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

export interface AdapterMarkdownSizeLimits {
  maxLines: number;
  maxLineBytes: number;
  safetyFactor: number;
  /** `ceil(max_lines × max_line_bytes × safety_factor)` — total UTF-8 document ceiling. */
  maxTotalBytes: number;
}

/** Read on each call so tests and env overrides apply without restart. */
export function getAdapterMarkdownSizeLimits(): AdapterMarkdownSizeLimits {
  const maxLines = readEnvInt('KAIROS_ADAPTER_MARKDOWN_MAX_LINES', 350);
  const maxLineBytes = readEnvInt('KAIROS_ADAPTER_MARKDOWN_MAX_LINE_BYTES', 8192);
  const raw = readEnvFloat('KAIROS_ADAPTER_MARKDOWN_SIZE_SAFETY_FACTOR', 1.15);
  const safetyFactor = raw >= 1 && Number.isFinite(raw) ? raw : 1.15;
  return {
    maxLines,
    maxLineBytes,
    safetyFactor,
    maxTotalBytes: Math.ceil(maxLines * maxLineBytes * safetyFactor)
  };
}
