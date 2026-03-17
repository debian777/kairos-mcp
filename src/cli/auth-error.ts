/**
 * Auth-related errors and handling (401 with login_url).
 * Auth message is written without "Error: " prefix; --open can open the URL.
 */

import { exec } from 'child_process';
import { platform } from 'os';
import { writeError, writeStderr } from './output.js';

export class AuthRequiredError extends Error {
    readonly loginUrl: string;

    constructor(message: string, loginUrl: string) {
        super(message);
        this.name = 'AuthRequiredError';
        this.loginUrl = loginUrl;
    }
}

/** True when BROWSER=true (tests/automation) or none/no/false/0; use in scripts/tests to disable opening. */
export function isBrowserDisabled(): boolean {
    const b = process.env['BROWSER'];
    return b != null && b !== '' && /^(true|none|no|false|0)$/i.test(b);
}

/** When set, used instead of system default (open/xdg-open/start). BROWSER=true or none skips opening. */
export function openBrowser(url: string): void {
    if (isBrowserDisabled()) return;
    const browserEnv = process.env['BROWSER'];
    if (browserEnv != null && browserEnv !== '') {
        exec(`${browserEnv} "${url}"`, (err) => {
            if (err) writeStderr(`Could not run BROWSER: ${err.message}. Open this URL manually:\n${url}`);
        });
        return;
    }
    const cmd =
        platform() === 'win32'
            ? `start "${url}"`
            : platform() === 'darwin'
              ? `open "${url}"`
              : `xdg-open "${url}"`;
    exec(cmd, (err) => {
        if (err) writeStderr(`Could not open browser: ${err.message}. Open this URL manually:\n${url}`);
    });
}

/**
 * Handle API errors: AuthRequiredError is printed without "Error: " prefix;
 * if openInBrowser is true, opens the login URL. Other errors use writeError.
 * Never returns (calls process.exit(1)).
 */
export function handleApiError(error: unknown, openInBrowser?: boolean): never {
    if (error instanceof AuthRequiredError) {
        writeStderr(error.message);
        if (openInBrowser) openBrowser(error.loginUrl);
        process.exit(1);
    }
    writeError(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
