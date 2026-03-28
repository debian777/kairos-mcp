/**
 * Shared JSON shape and path helpers for CLI config (used by config-file read and write).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

const CONFIG_DIR_NAME = 'kairos';
const CONFIG_FILE_NAME = 'config.json';
export const KEYCHAIN_TOKEN_PLACEHOLDER = '__KEYCHAIN__';

export interface EnvironmentEntry {
    bearerToken?: string;
    refreshToken?: string;
}

export interface ConfigFileShape {
    defaultUrl?: string;
    environments?: Record<string, EnvironmentEntry>;
    KAIROS_API_URL?: string;
    bearerToken?: string;
    refreshToken?: string;
}

export function isKeychainTokenPlaceholder(value: unknown): value is typeof KEYCHAIN_TOKEN_PLACEHOLDER {
    return value === KEYCHAIN_TOKEN_PLACEHOLDER;
}

export function normalizeApiUrl(url: string): string {
    return url.replace(/\/$/, '');
}

export function isSingleEnvFlatConfig(parsed: ConfigFileShape): boolean {
    return (
        parsed.environments === undefined &&
        (
            parsed.KAIROS_API_URL !== undefined ||
            parsed.bearerToken !== undefined ||
            parsed.refreshToken !== undefined
        )
    );
}

export function parseConfigFile(path: string): ConfigFileShape | null {
    if (!existsSync(path)) return null;
    try {
        const raw = readFileSync(path, 'utf-8');
        return JSON.parse(raw) as ConfigFileShape;
    } catch {
        return null;
    }
}

export function writeConfigShape(shape: ConfigFileShape): void {
    const dir = getConfigDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = getConfigPath();
    writeFileSync(path, JSON.stringify(shape, null, 2), { mode: 0o600 });
}

export function getConfigDir(): string {
    if (platform() === 'win32') {
        const appData = process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming');
        return join(appData, CONFIG_DIR_NAME);
    }
    const base = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
    return join(base, CONFIG_DIR_NAME);
}

export function getConfigPath(): string {
    return join(getConfigDir(), CONFIG_FILE_NAME);
}
