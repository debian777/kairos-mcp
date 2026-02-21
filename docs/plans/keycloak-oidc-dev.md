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
| `keycloak/import/kairos-{dev,qa,prod}-realm.json` | One realm per env: kairos-dev, kairos-qa, kairos-prod. |
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

- **Path in container:** `/opt/keycloak/data/import` (mount `./keycloak/import` or `${VOLUME_LOCAL_PATH}/keycloak/import`).
- **Startup:** Add `--import-realm` to Keycloak command so the realm is imported on first start (dev only).
- **Realm names:** `kairos-dev`, `kairos-qa`, `kairos-prod` (one realm per env; see **Realm per environment** below).
- **Client:** `kairos-mcp`, public, with flows needed for dev (e.g. standard flow; direct access grants only if required for CLI/agents, with a note to prefer device flow later).
- **Groups:** e.g. `kairos-team-platform`, `kairos-team-sre` for future team mapping.
- **Claim conventions (for later app work):** Use `sub` as canonical user id; `email` / `email_verified` for metadata; `groups` → internal team ids. Naming `kairos-team-<team>` keeps parsing stable.

### Realm per environment

We use **one Keycloak, three realms**: `kairos-dev`, `kairos-qa`, `kairos-prod`. Realm JSONs are in `keycloak/import/` (`kairos-dev-realm.json`, `kairos-qa-realm.json`, `kairos-prod-realm.json`). Keycloak imports all `.json` files on startup. Each realm has client `kairos-mcp` and groups `kairos-team-platform`, `kairos-team-sre`. Prod realm has `registrationAllowed: false` and `directAccessGrantsEnabled: false`. Set the app’s `AUTH_TRUSTED_ISSUERS` per env to the chosen realm’s issuer (e.g. `http://keycloak:8080/realms/kairos-dev`).

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
- [x] Create `keycloak/import/kairos-{dev,qa,prod}-realm.json` with realms kairos-dev, kairos-qa, kairos-prod; client `kairos-mcp` and groups in each.
- [x] Mount import dir to `/opt/keycloak/data/import`, command `start-dev --import-realm`.
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
rm -rf ./data/keycloak_pgdata
./scripts/generate-dev-secrets.sh
docker compose --profile infra up -d
```

- Keycloak admin: `http://localhost:8080` — username `admin`, password is in `.env` as `KEYCLOAK_ADMIN_PASSWORD` (not admin/keycloak).
- Realms: `kairos-dev`, `kairos-qa`, `kairos-prod`. Create local users and assign groups as needed for testing.

---

## 9. References

- Proposed: `cache/proposed/01-keycloak-compose-dev.md`
- Keycloak containers: [keycloak/keycloak docs/guides/server/containers.adoc](https://github.com/keycloak/keycloak/blob/main/docs/guides/server/containers.adoc) (import realm, start-dev).
- Context7: Keycloak Docker Compose with Postgres, healthchecks, `depends_on` with `condition: service_healthy`.
- Existing: `compose.yaml`, `docs/architecture/infrastructure.md`, `src/config.ts`.
