# Authentication overview

When **AUTH_ENABLED** is true, the KAIROS server requires authentication for `/api`, `/api/*`, `/mcp`, and `/ui`. This document summarises how server auth, API clients, and the CLI fit together.

## Server

- **Mechanisms:** Session cookie (browser, OAuth PKCE via Keycloak) or **Bearer JWT** (validated with JWKS; issuer and audience from config).
- **Unauthenticated requests:** GET (non-MCP) → 302 redirect to IdP; POST / MCP → **401** with JSON `{ error, message, login_url }` and `WWW-Authenticate` header (RFC 9728 / MCP discovery).
- **Discovery:** `GET /.well-known/oauth-protected-resource` (no auth) returns `authorization_servers`, `authorization_endpoint`, `token_endpoint`, `resource`, and `kairos_cli_client_id` (KAIROS-specific extension) so clients can build login URLs without hitting 401 first. In production, serve the app (and well-known) over HTTPS.

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
- **Contract:**  
  1. **Try read:** Token from config file only (CLI does **not** read `KAIROS_BEARER_TOKEN` from the environment).  
  2. **If absent:** Perform auth (see below), then **save** the token (and optionally API URL) to that same config file.
- **CLI:** Reads token **only** from config file. `kairos login` (browser PKCE or `--token`) performs auth and writes to config. Other commands use the token from config; on 401 they prompt to log in.
- **MCP:** The host (e.g. Cursor) that connects to KAIROS should read the token from the same config path. If no token, the host can discover auth endpoints via `/.well-known/oauth-protected-resource` (which exposes `kairos_cli_client_id`), perform OAuth PKCE using that client, and write the token to the config path so CLI and MCP share it. Alternatively, the host can direct the user to run `kairos login` first.

## CLI

- **Token source:** Config file only. `$XDG_CONFIG_HOME/kairos/config.json` (or `%APPDATA%\kairos\config.json` on Windows). Created by `kairos login` with mode `0o600`. The CLI does **not** use the `KAIROS_BEARER_TOKEN` environment variable.
- **Login:** `kairos login --token <token>` validates the token with `GET /api/me` and writes it (and the API URL) to config. `kairos login` (no flag) runs browser PKCE: the CLI uses a **hardcoded** `client_id` (`kairos-cli`) and discovers auth/token endpoints from well-known; it binds to an **open port** and sends that callback URL to Keycloak (best practice). The callback path includes a per-request token to avoid shared-link attacks. **Requirement:** run `python3 scripts/configure-keycloak-realms.py` so the `kairos-cli` client exists in Keycloak with redirect URIs allowing `http://localhost:*/callback/*`. Tests use `kairos login --no-browser` to get the URL from stdout; port can be pinned via `KAIROS_LOGIN_CALLBACK_PORT` (see [CLI.md](../CLI.md)).
- **Logout:** `kairos logout` clears the stored token from config only (env unchanged).
- **401 handling:** When auth is required, the CLI opens the browser by default (same PKCE flow as `kairos login`) and retries after storing the token. Use **`--no-browser`** to disable (e.g. in tests or scripts); then run `kairos login` and re-run the command.

See [CLI.md](../CLI.md) for full CLI usage and authentication.
