# Keycloak realm import

This directory is mounted into the Keycloak container at `/opt/keycloak/data/import` when using Docker Compose. Keycloak is started with `--import-realm` (see `compose.yaml`), so any `*-realm.json` files here are imported on startup.

## Files

- **kairos-dev-realm.json** – Dev realm: realm `kairos-dev`, client `kairos-mcp` (direct access grants, redirect URIs).
- **kairos-qa-realm.json** – QA realm: realm `kairos-qa`, client `kairos-mcp`.
- **kairos-prod-realm.json** – Prod realm (if used).

If a realm already exists (e.g. after a previous run), Keycloak skips importing it and does not overwrite.

## Trusted Hosts (Cursor MCP / DCR)

Cursor (and other MCP clients) may use **Dynamic Client Registration (DCR)**. Keycloak’s **Client registration → Trusted Hosts** policy can reject that with: *"Policy 'Trusted Hosts' rejected request. Details: Host not trusted."*

After realm import, run (uses Admin API; same env as test user):

- `npm run keycloak:ensure-trusted-hosts:dev` or `npm run keycloak:ensure-trusted-hosts:qa`

This disables **“Client URIs must match”** for the realm so DCR from any host and with any redirect URI (e.g. cursor://) works. Keycloak does not support a wildcard in the trusted hosts list; disabling both checks allows all. It is also run automatically when you run `npm run keycloak:ensure-test-user:dev` (or `:qa`).

## Test user (dev / qa)

Realms and the `kairos-mcp` client come from these JSON files. **Users are not in the import** (Keycloak user import expects hashed credentials from an export). The test user is **hardcoded** for dev/qa: `kairos-tester` / `kairos-tester-secret`.

1. **From .env:** set `KEYCLOAK_ADMIN_PASSWORD` (for Admin API).
2. **Create the user:** run  
   `npm run keycloak:ensure-test-user:dev` or `npm run keycloak:ensure-test-user:qa`  
   which uses `scripts/add_keycloak_user.py` to create `kairos-tester` with that password.  
   (Or use `scripts/add-keycloak-demo-user.sh` for a demo user via kcadm.sh in the container.)

Auth integration tests use the same hardcoded user and provision it via the Admin API when `KEYCLOAK_DEV_URL` is set (see `tests/utils/keycloak-container.ts`).

## Naming

- Realm config: `<realm>-realm.json`.
- User files (if you add exported users): `<realm>-users-<n>.json` (see [Keycloak import/export](https://www.keycloak.org/server/importExport)).
