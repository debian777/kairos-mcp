/**
 * kairos login — obtain and store a Bearer token (--token or browser + PKCE).
 */

import { Command } from 'commander';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { getApiUrl } from '../config.js';

/** Hardcoded OIDC client_id for CLI; realm must have this client with redirect URIs allowing http://localhost:* */
const KAIROS_CLI_CLIENT_ID = 'kairos-cli';

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

import { openBrowser } from '../auth-error.js';
import { getDefaultApiUrlFromFile, readConfig, writeConfig, normalizeApiUrl } from '../config-file.js';
import { getToken, isKeyringAvailable } from '../keyring.js';
import { writeError, writeStdout, writeStderr } from '../output.js';

/** Describe where the current token is stored (no path). Used for "Already authenticated. Token …" message. */
async function getTokenStorageHint(baseUrl: string, token: string): Promise<string> {
    const normalized = normalizeApiUrl(baseUrl);
    if (isKeyringAvailable()) {
        const fromKeyring = await getToken(normalized);
        if (fromKeyring === token) return 'Token stored in keychain.';
    }
    return 'Token in config file.';
}

/** Resolve current API base URL (env, then config default, then getApiUrl()). Exported for logout. */
export function getBaseUrl(): string {
    return (process.env['KAIROS_API_URL'] || getDefaultApiUrlFromFile() || getApiUrl()).replace(/\/$/, '');
}

/** Check if token is valid (GET /api/me). Used by login to skip relogin and by ApiClient. */
export async function isTokenValid(baseUrl: string, token: string): Promise<boolean> {
    // codeql[js/file-access-to-http]: CLI uses configured API base URL (env or saved config) for Kairos requests by design.
    const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
}

async function loginWithToken(baseUrl: string, token: string): Promise<boolean> {
    // codeql[js/file-access-to-http]: CLI uses configured API base URL (env or saved config) for Kairos requests by design.
    const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        writeError(body.message || `HTTP ${res.status}: token invalid or expired`);
        return false;
    }
    await writeConfig({ apiUrl: baseUrl, bearerToken: token });
    writeStdout('Token validated and stored.');
    return true;
}

interface WellKnownMeta {
    authorization_servers?: string[];
    authorization_endpoint?: string;
    token_endpoint?: string;
    kairos_cli_client_id?: string;
}

export interface LoginWithBrowserOptions {
    /** If true, only print auth URL to stdout; do not open browser. */
    noBrowser?: boolean;
}

/** Run browser PKCE login and store token. Exported for 401+--open retry from ApiClient. */
export async function loginWithBrowser(baseUrl: string, options?: LoginWithBrowserOptions): Promise<boolean> {
    const wellKnownUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
    // codeql[js/file-access-to-http]: CLI uses configured API base URL (env or saved config) for Kairos requests by design.
    const wkRes = await fetch(wellKnownUrl);
    if (!wkRes.ok) {
        writeError(`Server did not return auth metadata (GET ${wellKnownUrl} → ${wkRes.status}). Is auth enabled?`);
        return false;
    }
    const meta = (await wkRes.json()) as WellKnownMeta;
    // CLI uses hardcoded client_id (standalone); only auth/token endpoints come from server
    const clientId = KAIROS_CLI_CLIENT_ID;

    // Prefer endpoints from well-known; fallback to building from issuer.
    const authEndpoint =
        meta.authorization_endpoint?.trim() ||
        (meta.authorization_servers?.[0] ? `${meta.authorization_servers[0].replace(/\/$/, '')}/protocol/openid-connect/auth` : '');
    const tokenEndpoint =
        meta.token_endpoint?.trim() ||
        (meta.authorization_servers?.[0] ? `${meta.authorization_servers[0].replace(/\/$/, '')}/protocol/openid-connect/token` : '');
    if (!authEndpoint || !tokenEndpoint) {
        writeError('Server metadata has no authorization_endpoint/token_endpoint and no authorization_servers.');
        return false;
    }

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url').replace(/=/g, '');
    const state = randomBytes(16).toString('base64url');
    // Request-bound token in callback path to avoid shared-link attacks: only this login attempt accepts this URL
    const callbackPathToken = randomBytes(16).toString('base64url');

    return new Promise((resolve) => {
        // Bind to an open port, then send that redirect_uri to Keycloak (best practice). Tests can pin port via KAIROS_LOGIN_CALLBACK_PORT.
        const callbackPortEnv = process.env['KAIROS_LOGIN_CALLBACK_PORT'];
        const requestedPort = callbackPortEnv ? parseInt(callbackPortEnv, 10) : 0;
        const noBrowser = !!options?.noBrowser;
        let listenPort = 0;
        const server = createServer(async (req, res) => {
            const url = new URL(req.url ?? '/', `http://localhost`);
            const expectedPath = `/callback/${callbackPathToken}`;
            if (url.pathname !== expectedPath) {
                res.writeHead(404).end();
                return;
            }
            const errorParam = url.searchParams.get('error');
            if (errorParam) {
                const desc = url.searchParams.get('error_description') || errorParam;
                res.writeHead(200, { 'Content-Type': 'text/html' }).end(
                    `<!DOCTYPE html><html><body><p>Login failed: ${escapeHtml(desc)}</p><p>Try again or run <code>kairos login</code> from the terminal.</p></body></html>`
                );
                writeError(`Login failed: ${desc}`);
                server.close();
                resolve(false);
                return;
            }
            const code = url.searchParams.get('code');
            const stateParam = url.searchParams.get('state');
            if (stateParam !== state || !code) {
                res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Invalid callback (missing code or state).');
                server.close();
                resolve(false);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' }).end(
                '<!DOCTYPE html><html><body><p>Login successful. You can close this tab.</p></body></html>'
            );
            server.close();

            try {
                const redirectUri = `http://localhost:${listenPort}${expectedPath}`;
                const tokenRes = await fetch(tokenEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirectUri,
                        client_id: clientId,
                        code_verifier: codeVerifier,
                    }),
                });
                if (!tokenRes.ok) {
                    const text = await tokenRes.text();
                    writeError(`Token exchange failed: ${tokenRes.status} ${text}`);
                    resolve(false);
                    return;
                }
                const tokens = (await tokenRes.json()) as { access_token?: string };
                if (!tokens.access_token) {
                    writeError('No access_token in response.');
                    resolve(false);
                    return;
                }
                await writeConfig({ apiUrl: baseUrl, bearerToken: tokens.access_token });
                writeStdout('Login successful. Token stored.');
                resolve(true);
            } catch (e) {
                writeError(e instanceof Error ? e.message : String(e));
                resolve(false);
            }
        });
        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                writeError(`Port ${requestedPort} in use or inaccessible. Set KAIROS_LOGIN_CALLBACK_PORT to another port.`);
            } else {
                writeError(err.message || String(err));
            }
            resolve(false);
        });
        server.listen(requestedPort, '127.0.0.1', () => {
            listenPort = (server.address() as { port: number }).port;
            const redirectUri = `http://localhost:${listenPort}/callback/${callbackPathToken}`;
            const authUrl = new URL(authEndpoint);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('scope', 'openid');
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
            authUrl.searchParams.set('prompt', 'login');
            const authUrlStr = authUrl.toString();
            if (noBrowser) {
                writeStdout(authUrlStr);
                writeStderr(authUrlStr); // also stderr so tests see it when stdout is pipe-buffered
            } else {
                openBrowser(authUrlStr);
                writeStdout('[i] Log in to KAIROS in the browser.');
                writeStdout(`[i] If the browser did not open, open this link:\n${authUrlStr}`);
                writeStdout('[i] Awaiting authentication in the browser.');
            }
        });
    });
}

export function loginCommand(program: Command): void {
    program
        .command('login')
        .description('Store a Bearer token (use --token or browser). Other commands auto-login when needed; login kept for testing.')
        .option('-t, --token <token>', 'Use this token (validated with GET /api/me)')
        .option('--no-browser', 'Only print login URL to stdout; do not open a browser')
        .action(async (opts: { token?: string; browser?: boolean }) => {
            try {
                const baseUrl = getBaseUrl();
                if (opts.token) {
                    const ok = await loginWithToken(baseUrl, opts.token);
                    process.exit(ok ? 0 : 1);
                    return;
                }
                const config = await readConfig(baseUrl);
                if (config.bearerToken && (await isTokenValid(baseUrl, config.bearerToken))) {
                    const storage = await getTokenStorageHint(baseUrl, config.bearerToken);
                    writeStdout(`Already authenticated. ${storage}`);
                    process.exit(0);
                    return;
                }
                // --no-browser can be on program or login command; preAction sets KAIROS_NO_BROWSER when on program
                const noBrowser = opts.browser === false || process.env['KAIROS_NO_BROWSER'] === '1';
                const ok = await loginWithBrowser(baseUrl, noBrowser ? { noBrowser: true } : undefined);
                process.exit(ok ? 0 : 1);
            } catch (error) {
                writeError(error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
}
