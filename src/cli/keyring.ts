/**
 * CLI keyring: OS-native credential storage for bearer tokens.
 * Uses @napi-rs/keyring (keytar-compatible API). Falls back to file-based storage
 * when keyring is unavailable (KAIROS_CLI_NO_KEYRING=1, headless Linux, CI).
 */

import { createRequire } from 'module';

const requireMod = createRequire(import.meta.url);
const SERVICE = 'kairos-cli';

type KeytarModule = {
    getPassword: (service: string, account: string) => Promise<string | null>;
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
};

let keytar: KeytarModule | null | undefined = undefined;

function loadKeyring(): KeytarModule | null {
    if (keytar !== undefined) return keytar;
    if (process.env['KAIROS_CLI_NO_KEYRING'] === '1' || process.env['KAIROS_CLI_NO_KEYRING'] === 'true') {
        keytar = null;
        return null;
    }
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
 * Store the bearer token for the given account. No-op if keyring unavailable.
 */
export async function setToken(account: string, token: string): Promise<void> {
    const mod = loadKeyring();
    if (!mod) return;
    try {
        await mod.setPassword(SERVICE, account, token);
    } catch {
        // Headless / no libsecret: ignore; config-file will fall back to file
    }
}

/**
 * Delete the stored bearer token for the given account. No-op if keyring unavailable.
 */
export async function deleteToken(account: string): Promise<void> {
    const mod = loadKeyring();
    if (!mod) return;
    try {
        await mod.deletePassword(SERVICE, account);
    } catch {
        // Ignore
    }
}
