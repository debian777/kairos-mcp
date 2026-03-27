/**
 * Rewrites OIDC login URLs from the API so redirect_uri matches the CLI's API base (--url).
 * The server builds redirect_uri from AUTH_CALLBACK_BASE_URL; when that differs from the host
 * the CLI targets, the browser flow would land on the wrong origin after Keycloak redirects.
 */

export function rewriteLoginUrlRedirectToApiBase(loginUrl: string, apiBaseUrl: string): string {
    let parsed: URL;
    try {
        parsed = new URL(loginUrl);
    } catch {
        return loginUrl;
    }
    const redirect = parsed.searchParams.get('redirect_uri');
    if (!redirect) {
        return loginUrl;
    }
    let redirectParsed: URL;
    try {
        redirectParsed = new URL(redirect);
    } catch {
        return loginUrl;
    }
    const path = redirectParsed.pathname.replace(/\/$/, '') || '/';
    if (!path.endsWith('/auth/callback')) {
        return loginUrl;
    }
    const base = apiBaseUrl.replace(/\/$/, '');
    const next = new URL(loginUrl);
    next.searchParams.set('redirect_uri', `${base}/auth/callback`);
    return next.toString();
}
