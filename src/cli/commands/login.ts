/**
 * kairos login — obtain and store a Bearer token (--token or browser + PKCE).
 */

import { Command } from 'commander';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { getApiUrl, KEYCLOAK_CLI_CLIENT_ID } from '../config.js';
import { openBrowser } from '../auth-error.js';
import { readConfig, writeConfig } from '../config-file.js';
import { writeError, writeStdout } from '../output.js';

function getBaseUrl(): string {
    const config = readConfig();
    return (process.env['KAIROS_API_URL'] || config.KAIROS_API_URL || getApiUrl()).replace(/\/$/, '');
}

async function loginWithToken(baseUrl: string, token: string): Promise<boolean> {
    const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        writeError(body.message || `HTTP ${res.status}: token invalid or expired`);
        return false;
    }
    writeConfig({ KAIROS_API_URL: baseUrl, KAIROS_BEARER_TOKEN: token });
    writeStdout('Token validated and stored.');
    return true;
}

interface WellKnownMeta {
    authorization_servers?: string[];
    authorization_endpoint?: string;
    token_endpoint?: string;
}

async function loginWithBrowser(baseUrl: string): Promise<boolean> {
    const clientId = (process.env['KAIROS_CLIENT_ID']?.trim() || KEYCLOAK_CLI_CLIENT_ID).trim();
    if (!clientId) {
        writeError('Browser login requires KAIROS_CLIENT_ID or KEYCLOAK_CLI_CLIENT_ID (public client ID). Use "kairos login --token <token>" instead.');
        return false;
    }

    const wellKnownUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
    const wkRes = await fetch(wellKnownUrl);
    if (!wkRes.ok) {
        writeError(`Server did not return auth metadata (GET ${wellKnownUrl} → ${wkRes.status}). Is auth enabled?`);
        return false;
    }
    const meta = (await wkRes.json()) as WellKnownMeta;
    // Prefer endpoints from well-known (Phase 3: obtain login URL without 401); fallback to building from issuer.
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

    return new Promise((resolve) => {
        let listenPort = 0;
        const server = createServer(async (req, res) => {
            const url = new URL(req.url ?? '/', `http://localhost`);
            if (url.pathname !== '/callback') {
                res.writeHead(404).end();
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
                const tokenRes = await fetch(tokenEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: `http://localhost:${listenPort}/callback`,
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
                writeConfig({ KAIROS_API_URL: baseUrl, KAIROS_BEARER_TOKEN: tokens.access_token });
                writeStdout('Login successful. Token stored.');
                resolve(true);
            } catch (e) {
                writeError(e instanceof Error ? e.message : String(e));
                resolve(false);
            }
        });
        server.listen(0, '127.0.0.1', () => {
            listenPort = (server.address() as { port: number }).port;
            const redirectUri = `http://localhost:${listenPort}/callback`;
            const authUrl = new URL(authEndpoint);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('scope', 'openid');
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
            authUrl.searchParams.set('prompt', 'login');
            openBrowser(authUrl.toString());
            writeStdout('Opening browser. Complete login in the browser.');
        });
    });
}

export function loginCommand(program: Command): void {
    program
        .command('login')
        .description('Store a Bearer token for the KAIROS server (use --token or browser login)')
        .option('-t, --token <token>', 'Use this token (validated with GET /api/me)')
        .action(async (opts: { token?: string }) => {
            try {
                const baseUrl = getBaseUrl();
                if (opts.token) {
                    const ok = await loginWithToken(baseUrl, opts.token);
                    process.exit(ok ? 0 : 1);
                    return;
                }
                const ok = await loginWithBrowser(baseUrl);
                process.exit(ok ? 0 : 1);
            } catch (error) {
                writeError(error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
}
