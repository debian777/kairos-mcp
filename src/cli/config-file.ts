/**
 * CLI config file: token and API URL storage (XDG-compliant, user-only readable).
 * Supports multiple environments keyed by KAIROS_API_URL (normalized, no trailing slash).
 *
 * New format:
 *   { "defaultUrl": "http://localhost:3300", "environments": { "http://localhost:3300": { "bearerToken": "..." }, ... } }
 * Legacy (single env): { "KAIROS_API_URL": "...", "bearerToken": "..." } — migrated on first write.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

export interface CliConfig {
    apiUrl?: string;
    bearerToken?: string;
}

/** Normalize base URL for use as config key (no trailing slash). */
export function normalizeApiUrl(url: string): string {
    return url.replace(/\/$/, '');
}

const CONFIG_DIR_NAME = 'kairos';
const CONFIG_FILE_NAME = 'config.json';

interface EnvironmentEntry {
    bearerToken?: string;
}

interface ConfigFileShape {
    defaultUrl?: string;
    environments?: Record<string, EnvironmentEntry>;
    // Legacy top-level keys (migrated on write)
    KAIROS_API_URL?: string;
    bearerToken?: string;
}

function isLegacyFormat(parsed: ConfigFileShape): boolean {
    return (
        parsed.environments === undefined &&
        (parsed.KAIROS_API_URL !== undefined || parsed.bearerToken !== undefined)
    );
}

function parseConfigFile(path: string): ConfigFileShape | null {
    if (!existsSync(path)) return null;
    try {
        const raw = readFileSync(path, 'utf-8');
        return JSON.parse(raw) as ConfigFileShape;
    } catch {
        return null;
    }
}

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
 * Read config from disk. When baseUrl is given, returns config for that environment (token for that URL).
 * When omitted, returns the default environment (defaultUrl). Returns empty object if file missing or invalid.
 */
export function readConfig(baseUrl?: string): CliConfig {
    const path = getConfigPath();
    const parsed = parseConfigFile(path);
    if (!parsed) return {};

    if (isLegacyFormat(parsed)) {
        const apiUrl = typeof parsed.KAIROS_API_URL === 'string' ? parsed.KAIROS_API_URL : undefined;
        const bearerToken = typeof parsed.bearerToken === 'string' ? parsed.bearerToken : undefined;
        if (baseUrl) {
            const normalized = normalizeApiUrl(baseUrl);
            if (apiUrl && normalizeApiUrl(apiUrl) === normalized) {
                const out: CliConfig = {};
                if (apiUrl) out.apiUrl = apiUrl;
                if (bearerToken) out.bearerToken = bearerToken;
                return out;
            }
            return { apiUrl: normalized };
        }
        const out: CliConfig = {};
        if (apiUrl) out.apiUrl = apiUrl;
        if (bearerToken) out.bearerToken = bearerToken;
        return out;
    }

    const environments = parsed.environments ?? {};
    const defaultUrl = typeof parsed.defaultUrl === 'string' ? normalizeApiUrl(parsed.defaultUrl) : undefined;
    const effectiveUrl = baseUrl ? normalizeApiUrl(baseUrl) : defaultUrl ?? Object.keys(environments)[0];
    if (!effectiveUrl) return {};

    const entry = environments[effectiveUrl];
    const bearerToken = entry && typeof entry.bearerToken === 'string' ? entry.bearerToken : undefined;
    const out: CliConfig = { apiUrl: effectiveUrl };
    if (bearerToken) out.bearerToken = bearerToken;
    return out;
}

/** Input for writeConfig: null for bearerToken means clear the token for that environment. */
export type WriteConfigInput = {
    apiUrl?: string;
    bearerToken?: string | null;
};

/**
 * Write config (merge with existing). Pass bearerToken: null to clear the token for the given apiUrl.
 * When apiUrl is provided, that environment is updated and set as defaultUrl. Creates directory and sets file mode 0o600.
 */
export function writeConfig(partial: WriteConfigInput): void {
    const dir = getConfigDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = getConfigPath();
    const parsed = parseConfigFile(path);

    let defaultUrl: string | undefined;
    let environments: Record<string, EnvironmentEntry>;

    if (!parsed || isLegacyFormat(parsed)) {
        defaultUrl =
            typeof parsed?.KAIROS_API_URL === 'string'
                ? normalizeApiUrl(parsed.KAIROS_API_URL)
                : undefined;
        environments = {};
        if (defaultUrl && typeof parsed?.bearerToken === 'string') {
            environments[defaultUrl] = { bearerToken: parsed.bearerToken };
        }
    } else {
        defaultUrl =
            typeof parsed.defaultUrl === 'string' ? normalizeApiUrl(parsed.defaultUrl) : undefined;
        environments = { ...(parsed.environments ?? {}) };
    }

    const partialUrl = partial.apiUrl !== undefined ? normalizeApiUrl(partial.apiUrl) : undefined;
    if (partialUrl !== undefined) {
        defaultUrl = partialUrl;
        if (!environments[partialUrl]) environments[partialUrl] = {};
        if (partial.bearerToken === null) {
            delete environments[partialUrl].bearerToken;
            const ent = environments[partialUrl];
            if (ent && Object.keys(ent).length === 0) delete environments[partialUrl];
        } else if (partial.bearerToken !== undefined) {
            environments[partialUrl].bearerToken = partial.bearerToken;
        }
    } else if (partial.bearerToken === null && defaultUrl) {
        const ent = environments[defaultUrl];
        if (ent) {
            delete ent.bearerToken;
            if (Object.keys(ent).length === 0) delete environments[defaultUrl];
        }
    } else if (partial.bearerToken !== undefined && partial.bearerToken !== null && defaultUrl) {
        const ent = environments[defaultUrl] ?? {};
        ent.bearerToken = partial.bearerToken;
        environments[defaultUrl] = ent;
    }

    const next: ConfigFileShape =
        defaultUrl !== undefined ? { defaultUrl, environments } : { environments };
    writeFileSync(path, JSON.stringify(next, null, 2), { mode: 0o600 });
}
