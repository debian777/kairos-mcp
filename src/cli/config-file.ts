/**
 * CLI config file: token and API URL storage (XDG-compliant, user-only readable).
 * File keys: KAIROS_API_URL, bearerToken.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

export interface CliConfig {
    apiUrl?: string;
    bearerToken?: string;
}

const CONFIG_DIR_NAME = 'kairos';
const CONFIG_FILE_NAME = 'config.json';

/**
 * Config directory: XDG_CONFIG_HOME/kairos on Unix; %APPDATA%\kairos on Windows.
 */
export function getConfigDir(): string {
    if (platform() === 'win32') {
        const appData = process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming');
        return join(appData, CONFIG_DIR_NAME);
    }
    const base = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
    return join(base, CONFIG_DIR_NAME);
}

/**
 * Full path to config file. Use this path for shared read/write so CLI and MCP hosts use the same file.
 */
export function getConfigPath(): string {
    return join(getConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Read config from disk. Returns empty object if file missing or invalid.
 */
export function readConfig(): CliConfig {
    const path = getConfigPath();
    if (!existsSync(path)) return {};
    try {
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const out: CliConfig = {};
        if (typeof parsed['KAIROS_API_URL'] === 'string') out.apiUrl = parsed['KAIROS_API_URL'];
        if (typeof parsed['bearerToken'] === 'string') out.bearerToken = parsed['bearerToken'];
        return out;
    } catch {
        return {};
    }
}

/** Input for writeConfig: null for bearerToken means clear the token. */
export type WriteConfigInput = {
    apiUrl?: string;
    bearerToken?: string | null;
};

/**
 * Write config (merge with existing). Pass bearerToken: null to clear. Creates directory and sets file mode 0o600.
 */
export function writeConfig(partial: WriteConfigInput): void {
    const dir = getConfigDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = getConfigPath();
    const current = readConfig();
    const next: Record<string, string | undefined> = {};
    if (current.apiUrl !== undefined) next['KAIROS_API_URL'] = current.apiUrl;
    if (current.bearerToken !== undefined) next['bearerToken'] = current.bearerToken;
    if (partial.apiUrl !== undefined) next['KAIROS_API_URL'] = partial.apiUrl;
    if (partial.bearerToken === null) delete next['bearerToken'];
    else if (partial.bearerToken !== undefined) next['bearerToken'] = partial.bearerToken;
    writeFileSync(path, JSON.stringify(next, null, 2), { mode: 0o600 });
}
