# Authentication overview

When **AUTH_ENABLED** is true, the KAIROS server requires authentication for `/api`, `/api/*`, `/mcp`, and `/ui`. This document summarises how server auth, API clients, and the CLI fit together.

## Server

- **Mechanisms:** Session cookie (browser, OAuth PKCE via Keycloak) or **Bearer JWT** (validated with JWKS; issuer and audience from config).
- **Unauthenticated requests:** GET (non-MCP) → 302 redirect to IdP; POST / MCP → **401** with JSON `{ error, message, login_url }` and `WWW-Authenticate` header (RFC 9728 / MCP discovery).
- **Discovery:** `GET /.well-known/oauth-protected-resource` and `GET /.well-known/oauth-protected-resource/mcp` (no auth) return `authorization_servers`, `authorization_endpoint`, `token_endpoint`, `resource`, `authorization_request_parameters`, and `kairos_cli_client_id` so clients can build login URLs without hitting 401 first. In production, serve the app (and well-known) over HTTPS.

**Session length alignment:** In each environment, the browser session cookie `Max-Age` (`SESSION_MAX_AGE_SEC` in server config) should match the IdP’s maximum SSO session for that deployment (see Keycloak realm `ssoSessionMaxLifespan` / `ssoSessionIdleTimeout` in repo imports). If the cookie outlives IdP SSO, users can keep a cookie while refresh and re-login flows fail.

See [install/README.md](../install/README.md) and [install/google-auth-dev.md](../install/google-auth-dev.md) for enabling auth and configuring Keycloak.

| Context | Typical session / token policy (examples) |
|--------|----------------------------------------|
| Local / dev Keycloak (repo imports) | Long SSO window (e.g. 7 days in current realm JSON); access token ~1 h; refresh until SSO ends |
| Production with a different IdP | Follow that IdP’s policy (e.g. shorter org-wide SSO); align `SESSION_MAX_AGE_SEC` and realm settings with the same cap |

## API and MCP

All REST endpoints and POST `/mcp` use the same auth middleware. There is no separate "API key" or "CLI-only" auth; **Bearer** and **session** are the only mechanisms. Clients that have a valid access token send `Authorization: Bearer <token>`.

## Shared config: CLI and MCP

**Three roles, two Keycloak clients, one config file:**

- **`kairos-mcp`** — Server's own client for browser redirect login (session cookie flow). Used by server auth middleware and callback handler.
- **`kairos-cli`** — Public client with PKCE for native/CLI/MCP-host login. Used by CLI `login` command and any MCP host doing OAuth.
- **`config.json`** — Single shared token file. Both CLI and MCP hosts read from and write to it. API server never touches it.

**Login workflow:** The CLI and MCP use the **same** OAuth 2.1 / PKCE login flow. The CLI uses a fixed **`client_id`** (`kairos-cli`) and a **dynamic callback URL** (bind to an open port, then send that URL to Keycloak; path includes a per-request token). MCP hosts may use the same client or a host-specific callback (e.g. `cursor://`). The token is stored in the shared config so one login serves both.

**Both CLI and MCP clients use the same token location** so one login works for both:

- **Config path:** `$XDG_CONFIG_HOME/kairos/config.json` (Unix) or `%APPDATA%\kairos\config.json` (Windows).
- **Storage model:** OS keyring first when available; config-file fallback when keyring access is unavailable or fails.
- **Sentinel placeholder:** When keyring storage succeeds, `config.json` keeps non-secret placeholders (`"__KEYCHAIN__"`) at `environments[<url>].bearerToken` / `refreshToken` so operators can see which URL has keychain-backed credentials. The placeholder is never used as an Authorization token.
- **Contract:**  
  1. **Try read:** Token from keyring first, otherwise from the shared config file. Bearer tokens are **not** read from process environment variables.  
  2. **If absent:** Perform auth (see below), then save the token for that API URL.
- **CLI:** Reads from keyring when possible, otherwise from the shared config file. `kairos login` (browser PKCE or `--token`) writes the token back through the same storage abstraction and persists `"__KEYCHAIN__"` placeholders when keychain storage is active. Other commands reuse that token and can trigger login on 401.
- **MCP:** The host (for example Cursor) can reuse the same local config/keyring state, or direct the user to run `kairos login` first. If no token is present, the host can discover auth endpoints via the well-known protected-resource metadata and perform its own OAuth PKCE flow. Hosts that read the access token only once at startup will not pick up rotations from the CLI; long-lived integrations should re-read the shared config on each request or implement refresh equivalent to the CLI `ApiClient` (or periodically re-run `kairos login`).

## CLI

- **Token source:** Keyring first, config-file fallback at `$XDG_CONFIG_HOME/kairos/config.json` (or `%APPDATA%\kairos\config.json` on Windows). Bearer tokens are **not** read from process environment variables.
- **Login:** `kairos login --token <token>` validates the token with `GET /api/me` and stores **only** the access token (any stored refresh token is cleared). `kairos login` (no flag) runs browser PKCE: the CLI uses the public client ID `kairos-cli`, discovers auth/token endpoints from well-known, binds a local callback port, and exchanges the code for an access token and (when the IdP issues one) a **refresh token**. The callback path includes a per-request token. **Requirement:** run `python3 scripts/deploy-configure-keycloak-realms.py` so the `kairos-cli` client exists in Keycloak with redirect URIs allowing `http://localhost:*/callback/*`. Tests use `kairos login --no-browser` to get the URL from stdout; port can be pinned via `KAIROS_LOGIN_CALLBACK_PORT` (see [CLI.md](../CLI.md)).
- **Logout:** `kairos logout` clears the stored access and refresh credentials for the current API URL.
- **401 handling:** When the access token is rejected, the CLI tries a **refresh_token** grant first if a refresh token is stored; on success it retries the request once. If refresh fails or no refresh token exists, the CLI opens the browser by default (same PKCE flow as `kairos login`) and retries after storing new tokens. Use **`--no-browser`** to disable (e.g. in tests or scripts); then run `kairos login` and re-run the command.
- **Token TTL:** Access token lifetime is set by **Keycloak** (or your IdP), not by KAIROS. Our realm import sets **`accessTokenLifespan`** to **3600** seconds (1 hour) for `kairos-dev` and `kairos-prod`. The CLI keeps the refresh token alongside the access token (browser login path) so long sessions do not require a browser on every access expiry. If you see frequent unexpected re-login, check realm token settings and apply `python3 scripts/deploy-configure-keycloak-realms.py`. For an external Keycloak, set **Realm → Realm settings → Tokens → Access Token Lifespan** (or the equivalent) as needed.

See [CLI.md](../CLI.md) for full CLI usage and authentication.
