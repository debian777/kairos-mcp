/**
 * Bearer JWT validation for OIDC (Keycloak). Verifies iss, aud, exp and signature via JWKS.
 * When KEYCLOAK_INTERNAL_URL is set, JWKS is fetched from that host so the app in Docker can reach Keycloak.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { decodeJwt } from "jose/jwt/decode";
import { KEYCLOAK_URL, KEYCLOAK_INTERNAL_URL, OIDC_GROUPS_ALLOWLIST } from "../config.js";
import { structuredLogger } from "../utils/structured-logger.js";
import {
  applyOidcGroupsAllowlist,
  enrichAuthPayloadFromVerifiedJwt,
  extractGroupsFromPayload,
  realmFromIssuer,
  type AccountKind
} from "./oidc-profile-claims.js";

export interface AuthPayload {
  sub: string;
  groups: string[];
  /** Raw issuer retained for deterministic space-id derivation across Keycloak hosts. */
  iss: string;
  /** Realm from token issuer (e.g. kairos-dev) for space isolation. */
  realm: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  identity_provider?: string;
  /** Set when profile claims allow derivation; omitted on older session cookies until re-login. */
  account_kind?: AccountKind;
  account_label?: string;
}

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Resolve JWKS fetch URL: use KEYCLOAK_INTERNAL_URL when token issuer is user-facing (localhost) so Docker app can reach Keycloak. */
function getJwksFetchUrl(issuer: string): string {
  const base = issuer.replace(/\/$/, "");
  if (KEYCLOAK_INTERNAL_URL && KEYCLOAK_URL && base.startsWith(KEYCLOAK_URL.replace(/\/$/, ""))) {
    const internalBase = KEYCLOAK_INTERNAL_URL.replace(/\/$/, "");
    return `${internalBase}${new URL(base).pathname}/protocol/openid-connect/certs`;
  }
  return `${base}/protocol/openid-connect/certs`;
}

function getJwksForIssuer(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = JWKS_CACHE.get(issuer);
  if (cached) return cached;
  const url = getJwksFetchUrl(issuer);
  const jwks = createRemoteJWKSet(new URL(url));
  JWKS_CACHE.set(issuer, jwks);
  return jwks;
}

/** Decode JWT payload without verification (issuer check only). */
function decodePayload(jwt: string): Record<string, unknown> {
  return decodeJwt(jwt) as Record<string, unknown>;
}

/**
 * Validate Bearer JWT: iss in trusted list, aud in allowed list, exp not expired, signature valid.
 * Returns auth payload or null if invalid.
 */
export async function validateBearerToken(
  token: string,
  trustedIssuers: string[],
  allowedAudiences: string[]
): Promise<AuthPayload | null> {
  if (!token || trustedIssuers.length === 0 || allowedAudiences.length === 0) return null;
  let payload: Record<string, unknown>;
  try {
    const unverified = decodePayload(token);
    if (process.env["AUTH_TRACE"] === "true" || process.env["LOG_LEVEL"] === "trace") {
      structuredLogger.info(`[auth] TRACE Bearer unverified payload raw=${JSON.stringify(unverified)}`);
    }
    const iss = typeof unverified["iss"] === "string" ? unverified["iss"] : undefined;
    if (!iss || !trustedIssuers.includes(iss)) {
      structuredLogger.info(
        `[auth] Bearer rejected: issuer not trusted token_iss=${iss ?? "missing"} trusted=${JSON.stringify(trustedIssuers)}`
      );
      return null;
    }
    const jwks = getJwksForIssuer(iss);
    const getKey = (protectedHeader: Parameters<ReturnType<typeof createRemoteJWKSet>>[0]) => jwks(protectedHeader);
    const { payload: p } = await jwtVerify(token, getKey, { issuer: iss });
    payload = p as Record<string, unknown>;
    if (process.env["AUTH_TRACE"] === "true" || process.env["LOG_LEVEL"] === "trace") {
      structuredLogger.info(`[auth] TRACE Bearer payload raw=${JSON.stringify(payload)}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    structuredLogger.info(`[auth] Bearer rejected: JWT verify failed err=${msg}`);
    return null;
  }
  const aud = payload["aud"];
  const audList = Array.isArray(aud) ? aud : typeof aud === "string" ? [aud] : [];
  const issForAud = typeof payload["iss"] === "string" ? payload["iss"] : "";
  // Keycloak: accept aud "account", or empty aud when issuer is a Keycloak realm (some tokens omit aud).
  const keycloakAccountAud = audList.includes("account") && issForAud.includes("/realms/");
  const keycloakEmptyAud = audList.length === 0 && issForAud.includes("/realms/");
  const hasAudience =
    allowedAudiences.some((a) => audList.includes(a)) || keycloakAccountAud || keycloakEmptyAud;
  if (!hasAudience) {
    structuredLogger.info(
      `[auth] Bearer rejected: audience not allowed token_aud=${JSON.stringify(audList)} allowed=${JSON.stringify(allowedAudiences)}`
    );
    return null;
  }
  const sub = typeof payload["sub"] === "string" ? payload["sub"] : "";
  if (!sub) return null;
  const iss = typeof payload["iss"] === "string" ? payload["iss"] : "";
  if (!iss) return null;
  const realm = realmFromIssuer(iss);
  const groups = applyOidcGroupsAllowlist(extractGroupsFromPayload(payload), OIDC_GROUPS_ALLOWLIST);
  const enrich = enrichAuthPayloadFromVerifiedJwt(payload);
  const result: AuthPayload = {
    sub,
    groups,
    iss,
    realm,
    account_kind: enrich.account_kind,
    account_label: enrich.account_label,
  };
  if (enrich.preferred_username !== undefined) result.preferred_username = enrich.preferred_username;
  if (enrich.name !== undefined) result.name = enrich.name;
  if (enrich.given_name !== undefined) result.given_name = enrich.given_name;
  if (enrich.family_name !== undefined) result.family_name = enrich.family_name;
  if (enrich.email !== undefined) result.email = enrich.email;
  if (enrich.email_verified !== undefined) result.email_verified = enrich.email_verified;
  if (enrich.identity_provider !== undefined) result.identity_provider = enrich.identity_provider;
  return result;
}
