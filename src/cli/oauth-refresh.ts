/**
 * OAuth refresh_token grant for CLI: discover token endpoint from
 * /.well-known/oauth-protected-resource, then POST refresh_token + client_id.
 */

/** Hardcoded OIDC client_id for CLI (same as login command). */
export const KAIROS_CLI_CLIENT_ID = 'kairos-cli';

export interface OAuthProtectedResourceMeta {
    authorization_servers?: string[];
    authorization_endpoint?: string;
    token_endpoint?: string;
}

export interface OAuthEndpoints {
    authEndpoint: string;
    tokenEndpoint: string;
}

/**
 * Fetch auth and token endpoints from the KAIROS well-known metadata.
 * Shared by browser PKCE login and refresh_token grant.
 */
export async function fetchOAuthProtectedResourceMetadata(
    baseUrl: string,
    fetchImpl: typeof fetch = fetch
): Promise<OAuthEndpoints | null> {
    const root = baseUrl.replace(/\/$/, '');
    const wellKnownUrl = `${root}/.well-known/oauth-protected-resource`;
    // codeql[js/file-access-to-http]: CLI uses configured API base URL for Kairos requests by design.
    const wkRes = await fetchImpl(wellKnownUrl);
    if (!wkRes.ok) return null;
    const meta = (await wkRes.json()) as OAuthProtectedResourceMeta;
    const authEndpoint =
        meta.authorization_endpoint?.trim() ||
        (meta.authorization_servers?.[0]
            ? `${meta.authorization_servers[0].replace(/\/$/, '')}/protocol/openid-connect/auth`
            : '');
    const tokenEndpoint =
        meta.token_endpoint?.trim() ||
        (meta.authorization_servers?.[0]
            ? `${meta.authorization_servers[0].replace(/\/$/, '')}/protocol/openid-connect/token`
            : '');
    if (!authEndpoint || !tokenEndpoint) return null;
    return { authEndpoint, tokenEndpoint };
}

export interface RefreshTokenResult {
    access_token: string;
    /** Present when the IdP rotates the refresh token. */
    refresh_token?: string | undefined;
}

/**
 * Exchange refresh_token for new tokens. Returns null on network/HTTP/body failure.
 */
export async function refreshAccessToken(
    baseUrl: string,
    refreshToken: string,
    fetchImpl: typeof fetch = fetch
): Promise<RefreshTokenResult | null> {
    const endpoints = await fetchOAuthProtectedResourceMetadata(baseUrl, fetchImpl);
    if (!endpoints) return null;
    const tokenRes = await fetchImpl(endpoints.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: KAIROS_CLI_CLIENT_ID,
        }),
    });
    if (!tokenRes.ok) return null;
    const body = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    if (!body.access_token) return null;
    const out: RefreshTokenResult = { access_token: body.access_token };
    if (typeof body.refresh_token === 'string' && body.refresh_token.length > 0) {
        out.refresh_token = body.refresh_token;
    }
    return out;
}

/** Seconds until JWT exp claim, or null if missing/unparseable. */
export function jwtExpiresInSeconds(accessToken: string): number | null {
    try {
        const parts = accessToken.split('.');
        const payloadB64 = parts[1];
        if (parts.length < 2 || payloadB64 === undefined) return null;
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as { exp?: number };
        if (typeof payload.exp !== 'number') return null;
        return payload.exp - Math.floor(Date.now() / 1000);
    } catch {
        return null;
    }
}
