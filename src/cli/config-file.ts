/**
 * CLI config file: token and API URL storage (XDG-compliant, user-only readable).
 * Supports multiple environments keyed by KAIROS_API_URL (normalized, no trailing slash).
 * When keyring is available, bearer tokens are stored in the OS keyring; the config file
 * holds only defaultUrl and environment keys. When keyring is unavailable, tokens are
 * stored in the file (with a one-time warning).
 *
 * New format:
 *   { "defaultUrl": "http://localhost:3300", "environments": { "http://localhost:3300": { "bearerToken": "..." }, ... } }
 * Legacy (single env): { "KAIROS_API_URL": "...", "bearerToken": "..." } — migrated on first write.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { getToken, setToken, deleteToken, isKeyringAvailable } from './keyring.js';
import { writeStderr } from './output.js';

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

let fallbackWarned = false;

function warnFallbackOnce(): void {
    if (!fallbackWarned) {
        fallbackWarned = true;
        writeStderr('Keyring unavailable; storing token in config file.');
    }
}

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

function writeConfigShape(shape: ConfigFileShape): void {
    const dir = getConfigDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = getConfigPath();
    writeFileSync(path, JSON.stringify(shape, null, 2), { mode: 0o600 });
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
 * Sync read of default API URL from config file (no keyring/token). Used by ApiClient constructor.
 */
export function getDefaultApiUrlFromFile(): string | undefined {
    const path = getConfigPath();
    const parsed = parseConfigFile(path);
    if (!parsed) return undefined;
    if (isLegacyFormat(parsed) && typeof parsed.KAIROS_API_URL === 'string') {
        return normalizeApiUrl(parsed.KAIROS_API_URL);
    }
    if (typeof parsed.defaultUrl === 'string') return normalizeApiUrl(parsed.defaultUrl);
    const envs = parsed.environments ?? {};
    const first = Object.keys(envs)[0];
    return first ? normalizeApiUrl(first) : undefined;
}

/**
 * Read config from disk. When baseUrl is given, returns config for that environment (token for that URL).
 * When omitted, returns the default environment (defaultUrl). Returns empty object if file missing or invalid.
 * Tokens are read from keyring when available; tokens in the file are migrated to keyring on first read.
 */
export async function readConfig(baseUrl?: string): Promise<CliConfig> {
    const path = getConfigPath();
    const parsed = parseConfigFile(path);
    if (!parsed) return {};

    let effectiveUrl: string | undefined;
    let tokenFromFile: string | undefined;

    if (isLegacyFormat(parsed)) {
        const apiUrl = typeof parsed.KAIROS_API_URL === 'string' ? parsed.KAIROS_API_URL : undefined;
        tokenFromFile = typeof parsed.bearerToken === 'string' ? parsed.bearerToken : undefined;
        if (baseUrl) {
            const normalized = normalizeApiUrl(baseUrl);
            if (apiUrl && normalizeApiUrl(apiUrl) === normalized) {
                const fromKeyring = await getToken(normalized);
                const token = fromKeyring ?? tokenFromFile;
                if (tokenFromFile && isKeyringAvailable()) {
                    const stored = await setToken(normalized, tokenFromFile);
                    if (stored) writeConfigShape({ defaultUrl: normalized, environments: {} });
                }
                const out: CliConfig = {};
                if (apiUrl) out.apiUrl = apiUrl;
                if (token) out.bearerToken = token;
                return out;
            }
            effectiveUrl = normalized;
        } else {
            effectiveUrl = apiUrl ?? '';
            if (!effectiveUrl) return {};
            const fromKeyring = await getToken(effectiveUrl);
            const token = fromKeyring ?? tokenFromFile;
            if (tokenFromFile && isKeyringAvailable()) {
                const stored = await setToken(effectiveUrl, tokenFromFile);
                if (stored) writeConfigShape({ defaultUrl: effectiveUrl, environments: {} });
            }
            const out: CliConfig = {};
            if (apiUrl) out.apiUrl = apiUrl;
            if (token) out.bearerToken = token;
            return out;
        }
    } else {
        const environments = parsed.environments ?? {};
        const defaultUrl = typeof parsed.defaultUrl === 'string' ? normalizeApiUrl(parsed.defaultUrl) : undefined;
        effectiveUrl = baseUrl ? normalizeApiUrl(baseUrl) : defaultUrl ?? Object.keys(environments)[0];
        if (!effectiveUrl) return {};
        const entry = environments[effectiveUrl];
        tokenFromFile = entry && typeof entry.bearerToken === 'string' ? entry.bearerToken : undefined;
    }

    if (!effectiveUrl) return {};
    const fromKeyring = await getToken(effectiveUrl);
    let token = fromKeyring;
    if (!token && tokenFromFile && isKeyringAvailable()) {
        const stored = await setToken(effectiveUrl, tokenFromFile);
        token = tokenFromFile;
        if (stored) {
            const parsed2 = parseConfigFile(path);
            if (parsed2 && !isLegacyFormat(parsed2)) {
                const envs = { ...(parsed2.environments ?? {}) };
                const ent = envs[effectiveUrl];
                if (ent) {
                    delete ent.bearerToken;
                    if (Object.keys(ent).length === 0) delete envs[effectiveUrl];
                }
                const next: ConfigFileShape =
                    typeof parsed2.defaultUrl === 'string' ? { defaultUrl: parsed2.defaultUrl, environments: envs } : { environments: envs };
                writeConfigShape(next);
            }
        }
    } else if (!token) {
        token = tokenFromFile ?? null;
    }

    const out: CliConfig = { apiUrl: effectiveUrl as string };
    if (token) out.bearerToken = token;
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
 * Token storage: OS keyring first; if keyring is unavailable or a keyring write fails, the token is written to the config file under XDG_CONFIG_HOME (or ~/.config/kairos / %APPDATA%\\kairos) with a one-time warning.
 */
export async function writeConfig(partial: WriteConfigInput): Promise<void> {
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
    const useKeyring = isKeyringAvailable();

    if (partialUrl !== undefined) {
        defaultUrl = partialUrl;
        if (!environments[partialUrl]) environments[partialUrl] = {};
        if (partial.bearerToken === null) {
            if (useKeyring) await deleteToken(partialUrl);
            delete environments[partialUrl].bearerToken;
            const ent = environments[partialUrl];
            if (ent && Object.keys(ent).length === 0) delete environments[partialUrl];
        } else if (partial.bearerToken !== undefined) {
            if (useKeyring) {
                const stored = await setToken(partialUrl, partial.bearerToken);
                if (stored) {
                    delete environments[partialUrl].bearerToken;
                    if (Object.keys(environments[partialUrl]).length === 0) delete environments[partialUrl];
                } else {
                    warnFallbackOnce();
                    environments[partialUrl].bearerToken = partial.bearerToken;
                }
            } else {
                warnFallbackOnce();
                environments[partialUrl].bearerToken = partial.bearerToken;
            }
        }
    } else if (partial.bearerToken === null && defaultUrl) {
        if (useKeyring) await deleteToken(defaultUrl);
        const ent = environments[defaultUrl];
        if (ent) {
            delete ent.bearerToken;
            if (Object.keys(ent).length === 0) delete environments[defaultUrl];
        }
    } else if (partial.bearerToken !== undefined && partial.bearerToken !== null && defaultUrl) {
        if (useKeyring) {
            const stored = await setToken(defaultUrl, partial.bearerToken);
            if (stored) {
                const ent = environments[defaultUrl];
                if (ent) {
                    delete ent.bearerToken;
                    if (Object.keys(ent).length === 0) delete environments[defaultUrl];
                } else {
                    environments[defaultUrl] = {};
                }
            } else {
                warnFallbackOnce();
                const ent = environments[defaultUrl] ?? {};
                ent.bearerToken = partial.bearerToken;
                environments[defaultUrl] = ent;
            }
        } else {
            warnFallbackOnce();
            const ent = environments[defaultUrl] ?? {};
            ent.bearerToken = partial.bearerToken;
            environments[defaultUrl] = ent;
        }
    }

    const next: ConfigFileShape =
        defaultUrl !== undefined ? { defaultUrl, environments } : { environments };
    writeConfigShape(next);
}
