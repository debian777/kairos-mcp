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

