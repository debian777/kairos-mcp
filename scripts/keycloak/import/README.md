# Keycloak realm import

Realm JSONs in this directory are applied **idempotently** by **scripts/configure-keycloak-realms.py** via the Admin API. No Docker import mount; do not use Keycloak `--import-realm` (would conflict with existing realms).

## Files

- **kairos-dev-realm.json** – Dev realm: `kairos-dev`, client `kairos-mcp` (direct access grants, redirect URIs). Browser SSO is kept; MCP clients should send `prompt=login` when building the auth URL (see `authorization_request_parameters` in `/.well-known/oauth-protected-resource`).
- **kairos-prod-realm.json** – Prod realm: `kairos-prod`, client `kairos-mcp`.

## Idempotent configuration: `configure-keycloak-realms.py`

Run when Keycloak is up (safe to re-run; merge/update, no duplicate realms):

```bash
npm run infra:up
# Or: python3 scripts/configure-keycloak-realms.py
# Optional: KEYCLOAK_URL=http://keycloak:8080
```

The script:

1. **Realms:** creates minimal realm if missing, then merges and PUTs config from `scripts/keycloak/import/*.json` (idempotent; preserves existing clients/flows by id).
2. **Trusted hosts:** set per realm (dev: 127.0.0.1 + Docker gateway; prod: app-prod).
3. **Test user** (dev only): `TEST_USERNAME` / `TEST_PASSWORD` from env (default `kairos-tester` / `kairos-tester-secret`).

Requires `KEYCLOAK_ADMIN_PASSWORD` in `.env` or environment. Optional: `KEYCLOAK_URL` (default `http://localhost:8080`), `TEST_USERNAME`, `TEST_PASSWORD`.

## Adding other users

For ad-hoc users (e.g. demo) with auto-generated password:

```bash
python3 scripts/add-keycloak-user --realm kairos-dev --user demo
# Or: scripts/add-keycloak-demo-user.sh
```

## MCP OAuth and multi-browser (already_logged_in)

The server exposes `authorization_request_parameters: { "prompt": "login" }` in `/.well-known/oauth-protected-resource`. MCP clients (e.g. Cursor) that support it should add these parameters to the authorization request when redirecting to Keycloak, so users get a fresh login for MCP without disabling SSO for normal browser use. If your MCP client does not yet support this, you may see `already_logged_in` when already logged in elsewhere; use a private window or a second browser with the same Keycloak base URL.

## Naming

- Realm config: `<realm>-realm.json`.
- User files (if you add exported users): `<realm>-users-<n>.json` (see [Keycloak import/export](https://www.keycloak.org/server/importExport)).
