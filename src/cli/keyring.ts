/**
 * CLI keyring: OS-native credential storage for bearer tokens.
 * Uses @napi-rs/keyring (keytar-compatible API). When keyring is unavailable or
 * fails at runtime, the CLI falls back to the config file at XDG_CONFIG_HOME/kairos
 * (or ~/.config/kairos on Unix, %APPDATA%\\kairos on Windows) for all users.
 */

import { createRequire } from 'module';

const requireMod = createRequire(import.meta.url);
const SERVICE = 'kairos-cli';

/** Distinct keyring account for refresh tokens (normalized API URL + suffix). */
const REFRESH_ACCOUNT_SUFFIX = '::refresh';

function refreshAccount(account: string): string {
    return `${account}${REFRESH_ACCOUNT_SUFFIX}`;
}

type KeytarModule = {
    getPassword: (service: string, account: string) => Promise<string | null>;
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
};

let keytar: KeytarModule | null | undefined = undefined;

function loadKeyring(): KeytarModule | null {
    if (keytar !== undefined) return keytar;
    try {
        const mod = requireMod('@napi-rs/keyring/keytar') as KeytarModule;
        keytar = mod;
        return mod;
    } catch {
        keytar = null;
        return null;
    }
}

/**
 * Whether the keyring backend is available (module loaded; may still throw at runtime on some systems).
 */
export function isKeyringAvailable(): boolean {
    return loadKeyring() !== null;
}

/**
 * Get the stored bearer token for the given account (normalized API URL). Returns null if not found or keyring unavailable.
 */
export async function getToken(account: string): Promise<string | null> {
    const mod = loadKeyring();
    if (!mod) return null;
    try {
        const password = await mod.getPassword(SERVICE, account);
        return password ?? null;
    } catch {
        return null;
    }
}

/**
 * Store the bearer token for the given account. Returns true if stored in keyring, false if keyring unavailable or setPassword threw (config-file will fall back to file).
 */
export async function setToken(account: string, token: string): Promise<boolean> {
    const mod = loadKeyring();
    if (!mod) return false;
    try {
        await mod.setPassword(SERVICE, account, token);
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete the stored bearer token for the given account. Returns true if deleted (or not present), false if keyring unavailable or deletePassword threw.
 */
export async function deleteToken(account: string): Promise<boolean> {
    const mod = loadKeyring();
    if (!mod) return false;
    try {
        await mod.deletePassword(SERVICE, account);
        return true;
    } catch {
        return false;
    }
}

export async function getRefreshToken(account: string): Promise<string | null> {
    const mod = loadKeyring();
    if (!mod) return null;
    try {
        const password = await mod.getPassword(SERVICE, refreshAccount(account));
        return password ?? null;
    } catch {
        return null;
    }
}

export async function setRefreshToken(account: string, token: string): Promise<boolean> {
    const mod = loadKeyring();
    if (!mod) return false;
    try {
        await mod.setPassword(SERVICE, refreshAccount(account), token);
        return true;
    } catch {
        return false;
    }
}

export async function deleteRefreshToken(account: string): Promise<boolean> {
    const mod = loadKeyring();
    if (!mod) return false;
    try {
        await mod.deletePassword(SERVICE, refreshAccount(account));
        return true;
    } catch {
        return false;
    }
}
