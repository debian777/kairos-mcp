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

/** When set, used instead of system default (open/xdg-open/start). URL is passed as first argument. */
export function openBrowser(url: string): void {
    const browserEnv = process.env['BROWSER'];
    if (browserEnv) {
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
