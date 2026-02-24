# Keycloak realm import

Realm JSONs in this directory are used by **scripts/configure-keycloak-realms.py** (Admin API). The script reads from `scripts/keycloak/import` relative to repo root. No Docker import mount is used.

## Files

- **kairos-dev-realm.json** – Dev realm: `kairos-dev`, client `kairos-mcp` (direct access grants, redirect URIs). Browser SSO is kept; MCP clients should send `prompt=login` when building the auth URL (see `authorization_request_parameters` in `/.well-known/oauth-protected-resource`).
- **kairos-qa-realm.json** – QA realm: `kairos-qa`, client `kairos-mcp`.
- **kairos-prod-realm.json** – Prod realm: `kairos-prod`, client `kairos-mcp`.

## One-shot configuration: `configure-keycloak-realms.py`

Run once Keycloak is up (idempotent):

```bash
npm run infra:up
# Or: python3 scripts/configure-keycloak-realms.py
# Optional: KEYCLOAK_URL=http://keycloak:8080
```

The script:

1. **Imports realms** from `scripts/keycloak/import/*.json` via Admin API (creates kairos-dev, kairos-qa, kairos-prod if missing).
2. **Sets trusted hosts** per realm (IP only, no port/wildcard): dev = 127.0.0.1 + Docker `kairos-network` gateway; qa = 127.0.0.1 + app-qa IP; prod = 127.0.0.1 + app-prod IP.
3. **Creates test user** (dev and qa only): `TEST_USERNAME` / `TEST_PASSWORD` from env (default `kairos-tester` / `kairos-tester-secret`).

Requires `KEYCLOAK_ADMIN_PASSWORD` in `.env.prod`, `.env`, or environment. Optional: `KEYCLOAK_URL` (default `http://localhost:8080`), `TEST_USERNAME`, `TEST_PASSWORD`.

## Adding other users

For ad-hoc users (e.g. demo) with auto-generated password:

```bash
python3 scripts/add_keycloak_user.py --realm kairos-dev --user demo
# Or: scripts/add-keycloak-demo-user.sh
```

## MCP OAuth and multi-browser (already_logged_in)

The server exposes `authorization_request_parameters: { "prompt": "login" }` in `/.well-known/oauth-protected-resource`. MCP clients (e.g. Cursor) that support it should add these parameters to the authorization request when redirecting to Keycloak, so users get a fresh login for MCP without disabling SSO for normal browser use. If your MCP client does not yet support this, you may see `already_logged_in` when already logged in elsewhere; use a private window or a second browser with the same Keycloak base URL.

## Naming

- Realm config: `<realm>-realm.json`.
- User files (if you add exported users): `<realm>-users-<n>.json` (see [Keycloak import/export](https://www.keycloak.org/server/importExport)).
