# Qdrant Multitenancy and Space Model

This document describes the space model, data separation rules, and environment variables for Keycloak OIDC + Qdrant multitenancy. See also [keycloak-oidc-dev.md](keycloak-oidc-dev.md) for auth setup.

## Space model

- **Space ID scheme:** `user:{sub}` (personal), `group:{groupId}` (team), `space:default` (no auth or single-tenant).
- **Allowed spaces:** Derived only from verified token/session: Keycloak `sub` → personal space; `groups` → group spaces. Stored in `SpaceContext` and used for every Qdrant filter and Redis key prefix.
- **Default write space:** Personal space (`user:{sub}`) when authenticated; otherwise `space:default` (see `DEFAULT_SPACE_ID`).

## MUST ALWAYS

- Derive allowed spaces only from verified token/session (Keycloak `sub` + `groups`).
- Filter every Qdrant read (search, scroll, retrieve) by `space_id` in the allowed list (via `buildSpaceFilter(getSpaceContext().allowedSpaceIds, ...)`).
- After retrieve-by-id, check the point's `space_id` is in `allowedSpaceIds`; otherwise return 404 (do not leak existence).
- Namespace every Redis key by space (request-scoped prefix from `getSpaceIdFromStorage()`).
- Validate any client-supplied `space_id` or `space` parameter against `allowedSpaceIds` before use.

## MUST NEVER

- Trust client-supplied space lists for authorization.
- Upsert to Qdrant without a server-derived `space_id`.
- Return or delete a point whose `space_id` is not in the request's allowed list (return 404; do not leak existence).

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_SPACE_ID` | Space used when auth is disabled or context is missing (e.g. startup, background jobs). | `space:default` (or `DEFAULT_TENANT_ID` if set) |
| `AUTH_ENABLED` | When `false`, single-tenant mode: all requests use `space:default`. | — |
| `AUTH_MODE` | Set to `oidc_bearer` to validate Bearer JWT (issuer, audience, exp). | — |
| `AUTH_TRUSTED_ISSUERS` | Comma-separated Keycloak issuer URLs. | — |
| `AUTH_ALLOWED_AUDIENCES` | Comma-separated audience values. | — |

Optional (for future use):

- `QDRANT_MULTITENANCY_HNSW` — if documented by Qdrant for per-tenant HNSW tuning, can be set for collection config.

## Troubleshooting

- **Bearer rejected (invalid_token):** Check `AUTH_TRUSTED_ISSUERS`, `AUTH_ALLOWED_AUDIENCES`, token `exp`, and Keycloak health. Ensure JWKS is reachable at `{issuer}/protocol/openid-connect/certs`.
- **Cross-tenant result suspected:** Verify space filter is applied in search/scroll (see `buildSpaceFilter`) and that retrieve-by-id checks `point.payload.space_id` against `allowedSpaceIds`.
- **Redis keys colliding:** Ensure auth middleware runs with `runWithSpaceContext(ctx, () => next())` so `getSpaceIdFromStorage()` is set for the request; without it, all keys use `DEFAULT_SPACE_ID`.
