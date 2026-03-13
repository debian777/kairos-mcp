/**
 * CLI config file: token and API URL storage (XDG-compliant, user-only readable).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

export interface CliConfig {
    KAIROS_API_URL?: string;
    KAIROS_BEARER_TOKEN?: string;
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

function getConfigPath(): string {
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
        if (typeof parsed['KAIROS_API_URL'] === 'string') out.KAIROS_API_URL = parsed['KAIROS_API_URL'];
        if (typeof parsed['KAIROS_BEARER_TOKEN'] === 'string') out.KAIROS_BEARER_TOKEN = parsed['KAIROS_BEARER_TOKEN'];
        return out;
    } catch {
        return {};
    }
}

/** Input for writeConfig: null for KAIROS_BEARER_TOKEN means clear the token. */
export type WriteConfigInput = {
    KAIROS_API_URL?: string;
    KAIROS_BEARER_TOKEN?: string | null;
};

/**
 * Write config (merge with existing). Pass KAIROS_BEARER_TOKEN: null to clear. Creates directory and sets file mode 0o600.
 */
export function writeConfig(partial: WriteConfigInput): void {
    const dir = getConfigDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = getConfigPath();
    const current = readConfig();
    const next: CliConfig = { ...current };
    if (partial.KAIROS_API_URL !== undefined) next.KAIROS_API_URL = partial.KAIROS_API_URL;
    if (partial.KAIROS_BEARER_TOKEN === null) delete next.KAIROS_BEARER_TOKEN;
    else if (partial.KAIROS_BEARER_TOKEN !== undefined) next.KAIROS_BEARER_TOKEN = partial.KAIROS_BEARER_TOKEN;
    writeFileSync(path, JSON.stringify(next, null, 2), { mode: 0o600 });
}
