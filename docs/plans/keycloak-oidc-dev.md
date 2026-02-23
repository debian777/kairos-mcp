# Plan: Keycloak OIDC for KAIROS (Dev Profile)

**Branch:** `feat/keycloak-oidc-dev`  
**Basis:** Proposed doc `01-keycloak-compose-dev.md` + Context7 Keycloak docs + existing `compose.yaml` topology.

This plan adds **Keycloak** as an OIDC identity provider for KAIROS in a **developer-only** setup: local users, realm import on startup, Postgres backend. Production hardening (TLS, hostname, proxy, backups) is out of scope.

---

## 1. Goals

- Run Keycloak + Postgres via Docker Compose under the **existing** `kairos-network` and volume layout.
- Keycloak uses the same **profiles** as other infra: `infra` and `prod` (so it starts with `docker compose --profile infra` or `--profile prod`).
- Auto-import a `kairos` realm with client `kairos-mcp` and groups so KAIROS can later key ownership by `sub` and map `groups` to teams.
- Align with official Keycloak container docs (Context7): `start-dev`, `--import-realm`, `/opt/keycloak/data/import`, Postgres healthcheck, `depends_on: condition: service_healthy`.

---

## 2. Files to Add/Change

| Path | Action |
|------|--------|
| `compose.yaml` | Add services `keycloak-db`, `keycloak` (profile `dev` or `auth`). |
| `scripts/keycloak/import/kairos-{dev,qa,prod}-realm.json` | One realm per env: kairos-dev, kairos-qa, kairos-prod. |
| `docs/architecture/infrastructure.md` | Update: port map, topology diagram, optional “Auth (dev)” section. |
| `docs/plans/keycloak-oidc-dev.md` | This plan. |

No application code changes in this phase (KAIROS app does not yet validate OIDC tokens; env vars are prepared for a future PR).

---

## 3. Compose Design (Adapted to Existing Stack)

- **Network:** Attach Keycloak and Postgres to `kairos-network` so future app containers can reach `http://keycloak:8080`.
- **Volumes:** Use `${VOLUME_LOCAL_PATH}/data/keycloak_pgdata` for Postgres so all data lives under the same root as Redis/Qdrant.
- **Profile:** `infra` and `prod`, like redis, qdrant, redisinsight. Start with:  
  `docker compose --profile infra up -d`  
  (Keycloak + keycloak-db start with infra; app with `--profile prod` when we wire auth).
- **Image:** Pin Keycloak (e.g. `quay.io/keycloak/keycloak:26.5.4`) for reproducibility; align with [Keycloak container guide](https://github.com/keycloak/keycloak/blob/main/docs/guides/server/containers.adoc).
- **Admin:** `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` (Keycloak 26+); dev-only values (e.g. `admin` / `admin`), documented in this plan and in `.env.dev` example only—never in production.
- **Health:** Postgres: `pg_isready -U keycloak -d keycloak`; Keycloak: `depends_on` with `condition: service_healthy` on Postgres. Optional: Keycloak health via `KC_HEALTH_ENABLED=true` and `wget /health/ready` for `keycloak` service healthcheck (Context7: use `/health`, `/health/ready`, `/health/live`).

---

## 4. Realm Import

- **Path:** Realm JSONs live in `scripts/keycloak/import`; use `scripts/configure-keycloak-realms.py` to create realms via Admin API (no Docker import mount).
- **Startup:** Add `--import-realm` to Keycloak command so the realm is imported on first start (dev only).
- **Realm names:** `kairos-dev`, `kairos-qa`, `kairos-prod` (one realm per env; see **Realm per environment** below).
- **Client:** `kairos-mcp`, public, with flows needed for dev (e.g. standard flow; direct access grants only if required for CLI/agents, with a note to prefer device flow later).
- **Groups:** e.g. `kairos-team-platform`, `kairos-team-sre` for future team mapping.
- **Claim conventions (for later app work):** Use `sub` as canonical user id; `email` / `email_verified` for metadata; `groups` → internal team ids. Naming `kairos-team-<team>` keeps parsing stable.

### Groups in token (for multitenancy)

The KAIROS app derives allowed spaces from `sub` (personal) and `groups` (team spaces). Configure the realm so the **access token** (or ID token) includes group membership:

1. **Client scope mapper:** In Keycloak Admin → Client scopes → (e.g. `groups` scope or the client’s scope) → Add mapper → By configuration → **Group Membership**. Set Token Claim Name to `groups`. Assign the scope to the client `kairos-mcp` (e.g. Optional Client Scopes).
2. **Or realm role → groups:** If you use realm roles instead of groups, add a mapper that puts `realm_access.roles` (or a custom claim) in the token; the app also reads `realm_access.roles` as a fallback for group ids.

Exact claim name the app accepts: `groups` (array of strings) or `realm_access.roles` (array of strings). After login, the callback and Bearer validation read these claims and populate session / `req.auth` so `getSpaceContext()` can compute `allowedSpaceIds`.

### Space isolation by realm and optional group IDs

Spaces are isolated by **realm** so that the same group name in different realms (e.g. `kairos-dev` vs `kairos-qa`) does not share data. The app derives the realm from the token’s `iss` (e.g. `http://keycloak:8080/realms/kairos-dev` → `kairos-dev`) and builds space IDs as:

- **Personal:** `user:<realm>:<sub>`
- **Group:** `group:<realm>:<ref>` where `ref` is the group identifier (see below).

So `group:kairos-dev:kairos-team-platform` and `group:kairos-qa:kairos-team-platform` are different spaces.

**Group rename stability:** If a group is renamed in Keycloak, space IDs based on group **name** would change and previous data would no longer be associated. To keep spaces stable across renames, the app supports an optional token claim **`group_ids`** (array of group UUID strings, same order as `groups`). When present, the app uses the group UUID for the space ID (e.g. `group:kairos-dev:a1b2c3d4-...`). Keycloak’s default Group Membership mapper does not add group IDs; to enable rename-stable spaces you need a **Script Mapper** or custom protocol mapper that adds a claim `group_ids` with the list of group UUIDs. When `group_ids` is missing, the app falls back to group names.

### Realm per environment

We use **one Keycloak, three realms**: `kairos-dev`, `kairos-qa`, `kairos-prod`. Realm JSONs are in `scripts/keycloak/import/` (`kairos-dev-realm.json`, `kairos-qa-realm.json`, `kairos-prod-realm.json`). Realms are created via `scripts/configure-keycloak-realms.py` (Admin API). Each realm has client `kairos-mcp` and groups `kairos-team-platform`, `kairos-team-sre`. Prod realm has `registrationAllowed: false` and `directAccessGrantsEnabled: false`. Set the app’s `AUTH_TRUSTED_ISSUERS` per env to the chosen realm’s issuer (e.g. `http://keycloak:8080/realms/kairos-dev`).

---

## 5. Environment and Future KAIROS App Integration

- **Keycloak URL (from app):** `http://keycloak:8080` (from same Docker network). Issuer for `kairos` realm: `http://keycloak:8080/realms/kairos`.
- **Reserved env vars for a future auth PR** (no implementation in this plan):  
  `AUTH_MODE=oidc_bearer`, `AUTH_TRUSTED_ISSUERS=http://keycloak:8080/realms/kairos`, `AUTH_ALLOWED_AUDIENCES=kairos-mcp`. Document in `docs/plans/keycloak-oidc-dev.md` and optionally in `src/config.ts` as placeholders.
- **.env.dev:** Example file listing Keycloak admin URL, realm, and client id; no secrets in repo.

---

## 6. Security and Scope

- **Dev/QA/self-hosted only.** No production hardening in this plan.
- **Later hardening:** TLS, proper hostname, restrict redirect URIs, disable open redirects, DB backups, separate admin credentials, consider disabling direct access grants in favour of device flow.

---

## 7. Implementation Checklist

- [x] Add `keycloak-db` (Postgres 16) and `keycloak` services to `compose.yaml` under profiles `infra` and `prod`.
- [x] Use `${VOLUME_LOCAL_PATH}/data/keycloak_pgdata` for Postgres volume.
- [x] Add Postgres healthcheck and Keycloak `depends_on: keycloak-db: condition: service_healthy`.
- [x] Create `scripts/keycloak/import/kairos-{dev,qa,prod}-realm.json` with realms kairos-dev, kairos-qa, kairos-prod; client `kairos-mcp` and groups in each.
- [x] Realms created via `scripts/configure-keycloak-realms.py` (Admin API); no Docker import mount.
- [x] Set `KC_HEALTH_ENABLED=true` (Keycloak healthcheck on container omitted to avoid image dependency on curl/wget).
- [x] Update `docs/architecture/infrastructure.md` (port map, volume layout, dev profile).
- [x] Add `env.dev.example` (and Keycloak section in `env.example.txt`) with Keycloak URL, realm, client id; copy to `.env` for `VOLUME_LOCAL_PATH` and to `.env.dev` for the app.
- [x] Document reserved auth env vars and claim conventions in this plan (and optionally in `src/config.ts` as comments).

---

## 8. Quick Start and reinit

**First time or after reinit:** Passwords are random and never committed. Generate them (script writes `.env`; you never share the file):

```bash
./scripts/generate-dev-secrets.sh
docker compose --profile infra up -d
```

**Reinit (fresh DB and new random passwords):**

```bash
docker compose --profile infra down -v
rm -rf ./data/postgres
./scripts/generate-dev-secrets.sh
# Copy password vars to .env.prod, then:
docker compose --env-file .env --env-file .env.prod --profile infra up -d
# Then: npm run infra:up (starts infra and configures Keycloak realms)
```

- Keycloak admin: `http://localhost:8080` — username `admin`, password is in `.env` as `KEYCLOAK_ADMIN_PASSWORD` (not admin/keycloak).
- Realms: `kairos-dev`, `kairos-qa`, `kairos-prod`. Create local users and assign groups as needed for testing.

**Make it work (current path):**
1. Ensure `.env.prod` has `KEYCLOAK_DB_PASSWORD` and `KEYCLOAK_ADMIN_PASSWORD` (run `./scripts/generate-dev-secrets.sh` if needed).
2. Start infra: `docker compose --env-file .env --env-file .env.prod --profile infra up -d`. Postgres creates the Keycloak DB from env (default Docker workflow); no init script.
3. Start infra (includes Keycloak realm setup from scripts/keycloak/import): `npm run infra:up`. To reconfigure realms only: `python3 scripts/configure-keycloak-realms.py`.

**Add an extra user (e.g. demo, password auto-generated):**
```bash
python3 scripts/add_keycloak_user.py --realm kairos-dev --user demo
# Output: realm=... username=... password=<generated>
```
Optional: `KEYCLOAK_URL` (default `http://localhost:8080`). Legacy: `./scripts/add-keycloak-demo-user.sh`.

### Cursor MCP and Dynamic Client Registration (Trusted Hosts)

When Cursor connects to kairos-dev with auth enabled, it may use **Dynamic Client Registration (DCR)** to get a client ID from Keycloak. Keycloak’s **Trusted Hosts** policy can reject that request with:

`Policy 'Trusted Hosts' rejected request to client-registration service. Details: Host not trusted.`

**Fix in Keycloak Admin:**

1. Open **Realm** → **Client registration** → **Trusted hosts** (or **Clients** → **Client registration** → **Trusted hosts**).
2. Either disable **“Client URIs must match”** for dev, or add the host Cursor uses:
   - Add **`localhost`** and/or **`127.0.0.1`** (and your machine’s LAN IP if you use it in redirect URIs).
   - If Keycloak logs show `Failed to verify remote host : <IP>`, add that IP to trusted hosts.
3. Save.

After that, Cursor’s DCR request should succeed and the Streamable HTTP connection can complete. If Cursor then falls back to SSE, our server only supports **Streamable HTTP** (POST `/mcp`), so the SSE attempt will fail with “Invalid content type, expected text/event-stream”; fixing Trusted Hosts avoids the fallback.

---

## 9. MCP Authorization Compliance (RFC 9728 / MCP Spec 2025-11-25)

The MCP Authorization specification requires servers to implement OAuth 2.0 Protected Resource Metadata ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)) so that MCP clients can discover how to authenticate.

### Canonical resource URI

The **canonical resource URI** for this MCP server is the `resource` value served at `/.well-known/oauth-protected-resource`. It is derived as `{AUTH_CALLBACK_BASE_URL}/mcp` (e.g. `https://mcp.example.com/mcp`).

MCP clients MUST include this URI as the `resource` parameter in both authorization and token requests per [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html). This binds tokens to the intended MCP server and prevents token reuse across services.

### Discovery endpoints

The server exposes Protected Resource Metadata at two paths (per RFC 9728 §3.1):

- `GET /.well-known/oauth-protected-resource` — root (fallback)
- `GET /.well-known/oauth-protected-resource/mcp` — path-specific (tried first by spec-compliant clients)

Both return the same JSON document containing `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported`, and `resource_name`.

### Token audience configuration

For full MCP compliance, configure Keycloak so that access tokens include the canonical resource URI in the `aud` claim. In practice this means one of:

1. Add the canonical resource URI (e.g. `https://mcp.example.com/mcp`) to `AUTH_ALLOWED_AUDIENCES` alongside the client id (`kairos-mcp`).
2. Or configure a Keycloak audience mapper on the `kairos-mcp` client that adds the canonical URI to the `aud` claim.

The server validates `aud` against `AUTH_ALLOWED_AUDIENCES` — at least one value must match.

### 401 and 403 responses

- **401 Unauthorized:** Returned for missing or invalid tokens. Includes `WWW-Authenticate: Bearer resource_metadata="<url>", scope="openid"` so clients can discover the authorization server.
- **403 Forbidden:** Returned when the token is valid but has insufficient scope. Includes `WWW-Authenticate: Bearer error="insufficient_scope", scope="<required>", resource_metadata="<url>"`. (Scope enforcement not yet active; only `openid` is required.)

### Client responsibilities (for deployers)

MCP clients connecting to KAIROS MUST:

1. Fetch Protected Resource Metadata from the well-known endpoint.
2. Discover the authorization server from `authorization_servers`.
3. Include the `resource` parameter in authorization and token requests (RFC 8707).
4. Use `Authorization: Bearer <token>` header for all requests (query string tokens are rejected).
5. Handle 401 by initiating or re-initiating the OAuth flow.
6. Handle 403 with `insufficient_scope` by requesting additional scopes (step-up authorization).

See: [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

---

## 10. References

- Proposed: `cache/proposed/01-keycloak-compose-dev.md`
- Keycloak containers: [keycloak/keycloak docs/guides/server/containers.adoc](https://github.com/keycloak/keycloak/blob/main/docs/guides/server/containers.adoc) (import realm, start-dev).
- Context7: Keycloak Docker Compose with Postgres, healthchecks, `depends_on` with `condition: service_healthy`.
- Existing: `compose.yaml`, `docs/architecture/infrastructure.md`, `src/config.ts`.
