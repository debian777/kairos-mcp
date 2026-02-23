# Plan: Avoid already_logged_in and ensure MCP authentication works (current state)

**Last updated:** 2026-02-23 — aligned with current repo state.

## Goal

- Avoid Keycloak log: `CUSTOM_REQUIRED_ACTION_ERROR`, `error="already_logged_in"`, `redirect_uri="cursor://anysphere.cursor-mcp/oauth/callback"`.
- Ensure MCP authentication works end-to-end (401 → OAuth → Bearer).

---

## Current state (what’s already done)

### 1. Keycloak realm configuration script

- **[scripts/configure-keycloak-realms.py](scripts/configure-keycloak-realms.py)**  
  - **Idempotent update:** Creates realm with minimal defaults only if missing; then **always** GETs current realm, merges with desired config from `scripts/keycloak/import/*.json`, and PUTs. So every run applies the realm JSON (clients, groups, etc.) to existing realms. No “create-only” behaviour anymore.
  - Merge logic in `_merge_realm()` preserves Keycloak-assigned `id`s for clients and authentication flows so PUT updates instead of duplicating.
  - Trusted hosts and test user are still applied after realm update.

### 2. Realm JSONs (no browser-no-sso)

- **kairos-dev**, **kairos-qa**, **kairos-prod** realm JSONs do **not** define:
  - `authenticationFlows` (no custom flow like `browser-no-sso`),
  - `authenticationFlowBindingOverrides` on the `kairos-mcp` client.
- So Keycloak uses the **default browser flow** (SSO cookie enabled). The chosen strategy to avoid `already_logged_in` is **not** “disable SSO per client” but **client-side `prompt=login`**.

### 3. Server-side: prompt=login

- **[src/http/http-auth-middleware.ts](src/http/http-auth-middleware.ts)**  
  - `buildLoginUrl()` includes `prompt: 'login'` in the auth URL params so **server-initiated** redirects (e.g. browser GET to protected path) force a fresh login and avoid “already logged in” in that flow.
- **[src/http/http-well-known.ts](src/http/http-well-known.ts)**  
  - Serves `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`.
  - Sets `authorization_request_parameters: { prompt: 'login' }` in the metadata so **MCP clients** that read RFC 9728 resource metadata can add `prompt=login` to the authorization request when they redirect to Keycloak.
- **[scripts/keycloak/import/README.md](scripts/keycloak/import/README.md)**  
  - Documents that the server exposes `authorization_request_parameters: { "prompt": "login" }` and that MCP clients that support it should add these when building the auth URL.
  - If the MCP client does not support it, workaround: use a private window or a second browser.

### 4. MCP auth flow (unchanged)

- When `AUTH_ENABLED`, protected paths (`/api`, `/mcp`) return 401 with `WWW-Authenticate` pointing at `resource_metadata=".../.well-known/oauth-protected-resource"`.
- Cursor (or other client) discovers auth server and redirects to Keycloak; after login, Keycloak redirects to `cursor://...` with code; client exchanges code for token and sends Bearer. Server validates Bearer when `AUTH_MODE=oidc_bearer` (or accepts Bearer without validation if not set).

---

## Why the error still appears (traced, not guessed)

1. **Keycloak log shows `redirect_uri="cursor://anysphere.cursor-mcp/oauth/callback"`** — So the request that hit Keycloak used Cursor's redirect URI, not the server's. The server's 401 JSON includes `login_url` with `redirect_uri=AUTH_CALLBACK_BASE_URL/auth/callback` (see `buildLoginUrl` in http-auth-middleware.ts). So **Cursor does not use our `login_url`** for the OAuth step; it builds its own authorization URL.

2. **How Cursor gets the auth URL** — Per MCP spec: on 401, client uses `resource_metadata` from WWW-Authenticate, GETs that URL (our `/.well-known/oauth-protected-resource`), gets `authorization_servers`, discovers AS metadata, runs the OAuth flow with **its own** `redirect_uri` (e.g. cursor://...) and client id. So the auth request is **built by Cursor**, not by our `login_url`.

3. **Where `prompt=login` can come from** — The only way it reaches Keycloak is if the **client** adds it when building the auth URL. We publish `authorization_request_parameters: { prompt: 'login' }` in the well-known response (http-well-known.ts). RFC 9728 allows extra metadata parameters; it does **not** require clients to merge them into the authorization request. So whether `prompt=login` is sent is **client implementation-dependent**.

4. **Conclusion** — The error appears because the request that reached Keycloak either did not include `prompt=login` (Cursor not merging `authorization_request_parameters`) or Keycloak still hit the already-logged-in path. We **do** send `authorization_request_parameters` (asserted in tests/integration/http-well-known.test.ts); we **cannot** force Cursor to use it. The reliable server-side fix is **browser-no-sso** for the kairos-mcp client.


---

## Options from here

### A. Rely on client behaviour (current approach)

- **Done:** Server exposes `prompt=login` in well-known and in server-built login URL.
- **Remaining:** Ensure Cursor (or your MCP client) uses `authorization_request_parameters` from the resource metadata when initiating OAuth. If it does, the error should stop. If it does not, the only server-side option is B.

### B. Use browser-no-sso for kairos-mcp (Keycloak-side fix)

- **Independent of client:** Add the custom flow `browser-no-sso` (Cookie DISABLED) and set `authenticationFlowBindingOverrides.browserFlow = "browser-no-sso"` for the `kairos-mcp` client in all three realm JSONs. Then run `configure-keycloak-realms.py` once; the existing merge+PUT will apply it to existing realms.
- **Effect:** Keycloak will never use the SSO cookie for that client, so “already logged in” is avoided even if the client does not send `prompt=login`. Trade-off: every MCP login shows the login form (no SSO for that client).

### C. Verification

- After any change: trigger MCP connection (or 401 then OAuth), confirm no `already_logged_in` in Keycloak logs and that the client receives a code and can call the server with Bearer.
- In Admin UI: for option B, confirm realm → Authentication → Flows has `browser-no-sso` and Clients → kairos-mcp → Authentication flow overrides → Browser flow = `browser-no-sso`.

---

## Summary

| Item | Status |
|------|--------|
| Script applies realm JSON to existing realms (merge + PUT) | Done |
| Realm JSONs include browser-no-sso / client override | Not present (strategy is prompt=login) |
| Server: login URL has prompt=login | Done |
| Server: well-known has authorization_request_parameters | Done |
| README: prompt=login and MCP client behaviour | Done |
| MCP client (Cursor) uses authorization_request_parameters | Unknown; if not, use option B or private window |

The plan is **up to date** with the repo: the implemented approach is **prompt=login** (server + well-known + docs). To fully avoid the error regardless of client, add **browser-no-sso** to the realm JSONs (option B) and re-run the script.
