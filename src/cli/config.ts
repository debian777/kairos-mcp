/**
 * CLI Configuration
 */

import { getDefaultApiUrlFromFile } from './config-file.js';

/**
 * Default API base for Commander --url and fallbacks: KAIROS_API_URL, then saved config defaultUrl, then localhost:3000.
 * Matches docs/CLI.md resolution order (without an explicit --url flag).
 */
export function getCliApiUrlDefault(): string {
    const env = (process.env['KAIROS_API_URL'] || '').trim();
    if (env) return env;
    const fromFile = getDefaultApiUrlFromFile();
    if (fromFile) return fromFile;
    return 'http://localhost:3000';
}

/**
 * Get the KAIROS API base URL (same as getCliApiUrlDefault).
 */
export function getApiUrl(): string {
    return getCliApiUrlDefault();
}

