# Authentication overview

When **AUTH_ENABLED** is true, the KAIROS server requires authentication for `/api`, `/api/*`, `/mcp`, and `/ui`. This document summarises how server auth, API clients, and the CLI fit together.

## Server

- **Mechanisms:** Session cookie (browser, OAuth PKCE via Keycloak) or **Bearer JWT** (validated with JWKS; issuer and audience from config).
- **Unauthenticated requests:** GET (non-MCP) → 302 redirect to IdP; POST / MCP → **401** with JSON `{ error, message, login_url }` and `WWW-Authenticate` header (RFC 9728 / MCP discovery).
- **Discovery:** `GET /.well-known/oauth-protected-resource` and `GET /.well-known/oauth-protected-resource/mcp` (no auth) return `authorization_servers`, `authorization_endpoint`, `token_endpoint`, `resource`, `authorization_request_parameters`, and `kairos_cli_client_id` so clients can build login URLs without hitting 401 first. In production, serve the app (and well-known) over HTTPS.

See [install/README.md](../install/README.md) and [install/google-auth-dev.md](../install/google-auth-dev.md) for enabling auth and configuring Keycloak.

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
- **Contract:**  
  1. **Try read:** Token from keyring first, otherwise from the shared config file. The CLI does **not** read `KAIROS_BEARER_TOKEN` from the environment.  
  2. **If absent:** Perform auth (see below), then save the token for that API URL.
- **CLI:** Reads from keyring when possible, otherwise from the shared config file. `kairos login` (browser PKCE or `--token`) writes the token back through the same storage abstraction. Other commands reuse that token and can trigger login on 401.
- **MCP:** The host (for example Cursor) can reuse the same local config/keyring state, or direct the user to run `kairos login` first. If no token is present, the host can discover auth endpoints via the well-known protected-resource metadata and perform its own OAuth PKCE flow.

## CLI

- **Token source:** Keyring first, config-file fallback at `$XDG_CONFIG_HOME/kairos/config.json` (or `%APPDATA%\kairos\config.json` on Windows). The CLI does **not** use the `KAIROS_BEARER_TOKEN` environment variable.
- **Login:** `kairos login --token <token>` validates the token with `GET /api/me` and stores it for the current API URL. `kairos login` (no flag) runs browser PKCE: the CLI uses the public client ID `kairos-cli`, discovers auth/token endpoints from well-known, binds a local callback port, and exchanges the code for an access token. The callback path includes a per-request token. **Requirement:** run `python3 scripts/configure-keycloak-realms.py` so the `kairos-cli` client exists in Keycloak with redirect URIs allowing `http://localhost:*/callback/*`. Tests use `kairos login --no-browser` to get the URL from stdout; port can be pinned via `KAIROS_LOGIN_CALLBACK_PORT` (see [CLI.md](../CLI.md)).
- **Logout:** `kairos logout` clears the stored token for the current API URL.
- **401 handling:** When auth is required, the CLI opens the browser by default (same PKCE flow as `kairos login`) and retries after storing the token. Use **`--no-browser`** to disable (e.g. in tests or scripts); then run `kairos login` and re-run the command.
- **Token TTL:** The CLI stores only the **access token** (no refresh). Token lifetime is set by **Keycloak**, not by KAIROS. Our realm import sets **`accessTokenLifespan`** to **3600** seconds (1 hour) for `kairos-dev` and `kairos-prod`. If you see "one query then re-login", the realm may be using Keycloak’s default (e.g. 5 min) or a misconfigured value. Apply the realm config so the 1 h value is used: `python3 scripts/configure-keycloak-realms.py`. If you use an external Keycloak, set **Realm → Realm settings → Tokens → Access Token Lifespan** (or the equivalent in your setup) to the desired seconds.

See [CLI.md](../CLI.md) for full CLI usage and authentication.
