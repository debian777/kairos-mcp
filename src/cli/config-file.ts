/**
 * CLI config file: token and API URL storage (XDG-compliant, user-only readable).
 * Supports multiple environments keyed by KAIROS_API_URL (normalized, no trailing slash).
 * When keyring is available, bearer and refresh tokens are stored in the OS keyring; the config file
 * holds only defaultUrl and environment keys. When keyring is unavailable, secrets are
 * stored in the file (with a one-time warning).
 *
 * New format:
 *   { "defaultUrl": "http://localhost:<PORT>", "environments": { "http://localhost:<PORT>": { "bearerToken": "..." }, ... } }
 * Older single-env shape: { "KAIROS_API_URL": "...", "bearerToken": "..." } — migrated on first write.
 */

import {
    getRefreshToken,
    getToken,
    isKeyringAvailable,
    setRefreshToken,
    setToken,
} from './keyring.js';
import {
    type ConfigFileShape,
    getConfigPath,
    isSingleEnvFlatConfig,
    normalizeApiUrl,
    parseConfigFile,
    writeConfigShape,
} from './config-file-internals.js';
export { writeConfig, type WriteConfigInput } from './config-file-write.js';
export { normalizeApiUrl, getConfigDir, getConfigPath } from './config-file-internals.js';

export interface CliConfig {
    apiUrl?: string;
    bearerToken?: string;
    /** Present after browser PKCE login when IdP issued a refresh_token; omitted for `login --token`. */
    refreshToken?: string;
}

/**
 * Sync read of default API URL from config file (no keyring/token). Used by ApiClient constructor.
 */
export function getDefaultApiUrlFromFile(): string | undefined {
    const path = getConfigPath();
    const parsed = parseConfigFile(path);
    if (!parsed) return undefined;
    if (isSingleEnvFlatConfig(parsed) && typeof parsed.KAIROS_API_URL === 'string') {
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
    let refreshFromFile: string | undefined;

    if (isSingleEnvFlatConfig(parsed)) {
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
                const refreshFromKeyring = await getRefreshToken(normalized);
                const out: CliConfig = {};
                if (apiUrl) out.apiUrl = apiUrl;
                if (token) out.bearerToken = token;
                if (refreshFromKeyring) out.refreshToken = refreshFromKeyring;
                return out;
            }
            effectiveUrl = normalized;
        } else {
            const rawUrl = apiUrl ?? '';
            if (!rawUrl) return {};
            const urlNorm = normalizeApiUrl(rawUrl);
            effectiveUrl = urlNorm;
            const fromKeyring = await getToken(urlNorm);
            const token = fromKeyring ?? tokenFromFile;
            if (tokenFromFile && isKeyringAvailable()) {
                const stored = await setToken(urlNorm, tokenFromFile);
                if (stored) writeConfigShape({ defaultUrl: urlNorm, environments: {} });
            }
            const refreshFromKeyring = await getRefreshToken(urlNorm);
            const out: CliConfig = {};
            if (apiUrl) out.apiUrl = apiUrl;
            if (token) out.bearerToken = token;
            if (refreshFromKeyring) out.refreshToken = refreshFromKeyring;
            return out;
        }
    } else {
        const environments = parsed.environments ?? {};
        const defaultUrl = typeof parsed.defaultUrl === 'string' ? normalizeApiUrl(parsed.defaultUrl) : undefined;
        effectiveUrl = baseUrl ? normalizeApiUrl(baseUrl) : defaultUrl ?? Object.keys(environments)[0];
        if (!effectiveUrl) return {};
        const entry = environments[effectiveUrl];
        tokenFromFile = entry && typeof entry.bearerToken === 'string' ? entry.bearerToken : undefined;
        refreshFromFile = entry && typeof entry.refreshToken === 'string' ? entry.refreshToken : undefined;
    }

    if (!effectiveUrl) return {};
    const fromKeyring = await getToken(effectiveUrl);
    let token = fromKeyring;
    if (!token && tokenFromFile && isKeyringAvailable()) {
        const stored = await setToken(effectiveUrl, tokenFromFile);
        token = tokenFromFile;
        if (stored) {
            const parsed2 = parseConfigFile(path);
            if (parsed2 && !isSingleEnvFlatConfig(parsed2)) {
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

    const fromKeyringR = await getRefreshToken(effectiveUrl);
    let refreshTok = fromKeyringR;
    if (!refreshTok && refreshFromFile && isKeyringAvailable()) {
        const stored = await setRefreshToken(effectiveUrl, refreshFromFile);
        refreshTok = refreshFromFile;
        if (stored) {
            const parsed2 = parseConfigFile(path);
            if (parsed2 && !isSingleEnvFlatConfig(parsed2)) {
                const envs = { ...(parsed2.environments ?? {}) };
                const ent = envs[effectiveUrl];
                if (ent) {
                    delete ent.refreshToken;
                    if (Object.keys(ent).length === 0) delete envs[effectiveUrl];
                }
                const next: ConfigFileShape =
                    typeof parsed2.defaultUrl === 'string' ? { defaultUrl: parsed2.defaultUrl, environments: envs } : { environments: envs };
                writeConfigShape(next);
            }
        }
    } else if (!refreshTok) {
        refreshTok = refreshFromFile ?? null;
    }

    const out: CliConfig = { apiUrl: effectiveUrl as string };
    if (token) out.bearerToken = token;
    if (refreshTok) out.refreshToken = refreshTok;
    return out;
}
