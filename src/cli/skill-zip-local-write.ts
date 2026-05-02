/**
 * Local disk write helpers for `skill_zip` CLI downloads: validate payload and resolve output paths
 * without using unsanitized remote filename strings as path segments (CodeQL js/http-to-file-access).
 */

import path from 'node:path';
import { DEFAULT_EXPORT_SKILL_ZIP_FILENAME } from '../config/export-zip-settings.js';

const DEFAULT_MAX_SKILL_ZIP_BYTES = 512 * 1024 * 1024;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function maxSkillZipDownloadBytes(): number {
  return parsePositiveInt(process.env['KAIROS_EXPORT_ZIP_MAX_DOWNLOAD_BYTES'], DEFAULT_MAX_SKILL_ZIP_BYTES);
}

/**
 * Accept only a single path segment like `my-export.zip` from server hints (Content-Disposition /
 * JSON). Rejects separators, odd characters, and long names.
 */
export function safeZipBasenameFromRemoteHint(name: string | undefined): string | null {
  if (name === undefined || name === null) return null;
  const s = String(name).trim();
  if (s.length === 0) return null;
  const base = path.basename(s.replace(/\\/g, '/'));
  if (!base || base === '.' || base === '..') return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/i.test(base)) return null;
  if (base.length > 200) return null;
  return base;
}

/**
 * Output path: explicit `--zip-out` (user-controlled), else `cwd/<sanitized remote basename or default>`.
 */
export function resolveSkillZipOutputPath(
  zipOut: string | undefined,
  hints: { downloadBasename?: string; refBasename?: string }
): string {
  if (zipOut !== undefined && zipOut.trim().length > 0) {
    return path.resolve(process.cwd(), zipOut.trim());
  }
  const remote =
    safeZipBasenameFromRemoteHint(hints.downloadBasename) ??
    safeZipBasenameFromRemoteHint(hints.refBasename);
  const base = remote ?? DEFAULT_EXPORT_SKILL_ZIP_FILENAME;
  return path.join(process.cwd(), base);
}

/** Reject non-ZIP payloads and oversized downloads before writing bytes from the network to disk. */
export function assertSkillZipBufferAllowedForDiskWrite(data: Buffer): void {
  const max = maxSkillZipDownloadBytes();
  if (data.length === 0) {
    throw new Error('Export ZIP download was empty.');
  }
  if (data.length > max) {
    throw new Error(
      `Export ZIP download exceeds configured maximum (${max} bytes); set KAIROS_EXPORT_ZIP_MAX_DOWNLOAD_BYTES to raise the cap.`
    );
  }
  const pk = data[0] === 0x50 && data[1] === 0x4b;
  if (!pk) {
    throw new Error('Export download did not look like a ZIP file (missing PK signature).');
  }
}
