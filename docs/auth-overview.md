# Authentication overview

When **AUTH_ENABLED** is true, the KAIROS server requires authentication for `/api`, `/api/*`, `/mcp`, and `/ui`. This document summarises how server auth, API clients, and the CLI fit together.

## Server

- **Mechanisms:** Session cookie (browser, OAuth PKCE via Keycloak) or **Bearer JWT** (validated with JWKS; issuer and audience from config).
- **Unauthenticated requests:** GET (non-MCP) → 302 redirect to IdP; POST / MCP → **401** with JSON `{ error, message, login_url }` and `WWW-Authenticate` header (RFC 9728 / MCP discovery).
- **Discovery:** `GET /.well-known/oauth-protected-resource` (no auth) returns `authorization_servers`, `authorization_endpoint`, `token_endpoint`, and `resource` so clients can build login URLs without hitting 401 first. In production, serve the app (and well-known) over HTTPS.

See [install/README.md](install/README.md) and [install/google-auth-dev.md](install/google-auth-dev.md) for enabling auth and configuring Keycloak.

## API and MCP

All REST endpoints and POST `/mcp` use the same auth middleware. There is no separate “API key” or “CLI-only” auth; **Bearer** and **session** are the only mechanisms. Clients that have a valid access token send `Authorization: Bearer <token>`.

## Shared config: CLI and MCP

**Both CLI and MCP clients use the same token location** so one login works for both:

- **Config path:** `$XDG_CONFIG_HOME/kairos/config.json` (Unix) or `%APPDATA%\kairos\config.json` (Windows). Env `KAIROS_BEARER_TOKEN` overrides the config file when set.
- **Contract:**  
  1. **Try read:** Use token from env, then from config file.  
  2. **If absent:** Perform auth (see below), then **save** the token (and optionally API URL) to that same config file.
- **CLI:** Reads from env then config; `kairos login` (browser or `--token`) performs auth and writes to config. Other commands use the token from env/config; on 401 they prompt to log in.
- **MCP:** The host (e.g. Cursor) that connects to KAIROS should read the token from the same path (or from `KAIROS_BEARER_TOKEN`). If no token, the host should direct the user to run `kairos login` (which saves to config), or implement the same OAuth PKCE flow and write the token to the config path so CLI and MCP share it.

## CLI

- **Token source:** Environment `KAIROS_BEARER_TOKEN` overrides config file. Config file: `$XDG_CONFIG_HOME/kairos/config.json` (or `%APPDATA%\kairos\config.json` on Windows). Created by `kairos login` with mode `0o600`.
- **Login:** `kairos login --token <token>` validates the token with `GET /api/me` and writes it (and the API URL) to config. `kairos login` (no flag) runs browser PKCE using well-known endpoints; the CLI uses the dedicated client ID from `KEYCLOAK_CLI_CLIENT_ID` (default `kairos-cli`), overridable with `KAIROS_CLIENT_ID`. **Requirement:** run `python3 scripts/configure-keycloak-realms.py` so the `kairos-cli` client exists in Keycloak; otherwise browser login fails with `client_not_found`. Callback port default is 38472 (see [CLI.md](CLI.md)).
- **Logout:** `kairos logout` clears the stored token from config only (env unchanged).
- **401 handling:** When a command gets 401 with `login_url`, the CLI throws `AuthRequiredError` and prints the message and URL. Use **`--open`** (e.g. `kairos --open search "query"`) to open that URL in the browser.

See [CLI.md](CLI.md) for full CLI usage and authentication.
