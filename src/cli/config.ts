/**
 * CLI Configuration
 */

function getEnvString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * Get the KAIROS API base URL
 * Defaults to http://localhost:3000 if not set
 */
export function getApiUrl(): string {
    return getEnvString('KAIROS_API_URL', 'http://localhost:3000');
}

/**
 * Keycloak CLI client ID for browser PKCE login.
 * Defaults to kairos-cli if not set.
 */
export const KEYCLOAK_CLI_CLIENT_ID =
    process.env['KEYCLOAK_CLI_CLIENT_ID']?.trim() || 'kairos-cli';

