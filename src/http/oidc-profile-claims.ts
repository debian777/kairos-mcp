/**
 * Whitelisted OIDC claims for session, Bearer auth, and GET /api/me.
 * Do not echo full JWTs — only explicitly allowed keys reduce risk of leaking future custom claims.
 *
 * If identity_provider is missing for broker/SSO users, add a Keycloak protocol mapper
 * (e.g. user session note → token claim) in the realm — that is realm configuration, not only app code.
 */
import { fromBase64url } from "@exodus/bytes/base64.js";
import { utf8toString } from "@exodus/bytes/utf8.js";

export type AccountKind = "local" | "sso";

/** IdPs treated as realm-local (not federated SSO) for UX labelling. */
const LOCAL_IDENTITY_PROVIDERS = new Set(["", "keycloak", "local"]);

const SSO_LABEL_OVERRIDES: Record<string, string> = {
  google: "Google",
  okta: "Okta",
  github: "GitHub",
  microsoft: "Microsoft",
  azuread: "Microsoft",
};

export interface WhitelistedProfileFields {
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  identity_provider?: string;
}

export interface AccountLabels {
  account_kind: AccountKind;
  account_label: string;
}

export interface MergedCallbackClaims {
  sub: string;
  groups: string[];
  realm: string;
  group_ids?: string[];
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  identity_provider?: string;
  account_kind: AccountKind;
  account_label: string;
}

/** Decode JWT payload object from compact serialization (same pattern as auth callback; not a signature verify). */
export function decodeJwtPayloadSegment(jwt: string): Record<string, unknown> | null {
  try {
    const segment = jwt.split(".")[1];
    if (!segment) return null;
    return JSON.parse(utf8toString(fromBase64url(segment))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract realm segment from issuer URL (e.g. …/realms/kairos-dev → kairos-dev). */
export function realmFromIssuer(iss: string): string {
  const match = /\/realms\/([^/]+)/.exec(iss);
  const segment = match?.[1] ?? iss.split("/").filter(Boolean).pop();
  return typeof segment === "string" ? segment : "default";
}

export function extractGroupsFromPayload(payload: Record<string, unknown>): string[] {
  const g = payload["groups"];
  if (Array.isArray(g)) return g.filter((x): x is string => typeof x === "string");
  return [];
}

export function extractGroupIdsFromPayload(payload: Record<string, unknown>): string[] | undefined {
  const g = payload["group_ids"];
  if (!Array.isArray(g)) return undefined;
  const ids = g.filter((x): x is string => typeof x === "string" && x.length > 0);
  return ids.length > 0 ? ids : undefined;
}

function pickNonEmptyString(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Whitelisted profile-style claims from a single verified (or callback-trusted) payload.
 */
export function extractWhitelistedProfileFromPayload(payload: Record<string, unknown>): WhitelistedProfileFields {
  const out: WhitelistedProfileFields = {};
  const pu = pickNonEmptyString(payload, "preferred_username");
  if (pu !== undefined) out.preferred_username = pu;
  const name = pickNonEmptyString(payload, "name");
  if (name !== undefined) out.name = name;
  const gn = pickNonEmptyString(payload, "given_name");
  if (gn !== undefined) out.given_name = gn;
  const fn = pickNonEmptyString(payload, "family_name");
  if (fn !== undefined) out.family_name = fn;
  const email = pickNonEmptyString(payload, "email");
  if (email !== undefined) out.email = email;
  const ev = payload["email_verified"];
  if (ev === true || ev === false) out.email_verified = ev;
  const idp = pickNonEmptyString(payload, "identity_provider");
  if (idp !== undefined) out.identity_provider = idp;
  return out;
}

export function deriveAccountKindAndLabel(identityProvider: string | undefined): AccountLabels {
  const raw = typeof identityProvider === "string" ? identityProvider.trim() : "";
  const lower = raw.toLowerCase();
  if (!raw || LOCAL_IDENTITY_PROVIDERS.has(lower)) {
    return { account_kind: "local", account_label: "Local" };
  }
  const base = SSO_LABEL_OVERRIDES[lower] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
  return { account_kind: "sso", account_label: `${base} (SSO)` };
}

/**
 * Merge id_token and access_token payloads after login:
 * — sub from id token when present; otherwise access. If both subs exist and differ, fail.
 * — groups / group_ids prefer access token; fallback to id.
 * — realm from id token iss, else access iss, else fallbackRealm.
 * — profile / email claims prefer id token; if id absent, fall back to access for CLI-style flows.
 */
export function mergeCallbackTokenPayloads(input: {
  idPayload: Record<string, unknown> | null;
  accessPayload: Record<string, unknown> | null;
  fallbackRealm: string;
}): { ok: true; merged: MergedCallbackClaims } | { ok: false; error: string } {
  const { idPayload, accessPayload, fallbackRealm } = input;
  const idSub = idPayload && typeof idPayload["sub"] === "string" ? idPayload["sub"] : "";
  const accessSub = accessPayload && typeof accessPayload["sub"] === "string" ? accessPayload["sub"] : "";
  let sub: string;
  if (idSub.length > 0) {
    sub = idSub;
    if (accessSub.length > 0 && accessSub !== idSub) {
      return { ok: false, error: "mismatched_sub" };
    }
  } else if (accessSub.length > 0) {
    sub = accessSub;
  } else {
    return { ok: false, error: "missing_sub" };
  }

  const accessGroups = accessPayload ? extractGroupsFromPayload(accessPayload) : [];
  const idGroups = idPayload ? extractGroupsFromPayload(idPayload) : [];
  const groups = accessGroups.length > 0 ? accessGroups : idGroups;

  let group_ids = accessPayload ? extractGroupIdsFromPayload(accessPayload) : undefined;
  if (group_ids === undefined && idPayload) group_ids = extractGroupIdsFromPayload(idPayload);

  let realm = fallbackRealm;
  const idIss = idPayload && typeof idPayload["iss"] === "string" ? idPayload["iss"] : "";
  const accessIss = accessPayload && typeof accessPayload["iss"] === "string" ? accessPayload["iss"] : "";
  if (idIss.length > 0) realm = realmFromIssuer(idIss);
  else if (accessIss.length > 0) realm = realmFromIssuer(accessIss);

  const profileFromId = idPayload ? extractWhitelistedProfileFromPayload(idPayload) : {};
  const profileFromAccess = accessPayload ? extractWhitelistedProfileFromPayload(accessPayload) : {};
  const profile =
    Object.keys(profileFromId).length > 0
      ? profileFromId
      : profileFromAccess;

  const { account_kind, account_label } = deriveAccountKindAndLabel(profile.identity_provider);

  const merged: MergedCallbackClaims = {
    sub,
    groups,
    realm,
    account_kind,
    account_label,
  };
  if (group_ids !== undefined) merged.group_ids = group_ids;
  if (profile.preferred_username !== undefined) merged.preferred_username = profile.preferred_username;
  if (profile.name !== undefined) merged.name = profile.name;
  if (profile.given_name !== undefined) merged.given_name = profile.given_name;
  if (profile.family_name !== undefined) merged.family_name = profile.family_name;
  if (profile.email !== undefined) merged.email = profile.email;
  if (profile.email_verified !== undefined) merged.email_verified = profile.email_verified;
  if (profile.identity_provider !== undefined) merged.identity_provider = profile.identity_provider;
  return { ok: true, merged };
}

export type AuthProfileEnrichment = Pick<
  MergedCallbackClaims,
  | "preferred_username"
  | "name"
  | "given_name"
  | "family_name"
  | "email"
  | "email_verified"
  | "identity_provider"
  | "account_kind"
  | "account_label"
>;

/** Attach profile + account labels to auth after Bearer verify (single token payload). */
export function enrichAuthPayloadFromVerifiedJwt(payload: Record<string, unknown>): AuthProfileEnrichment {
  const profile = extractWhitelistedProfileFromPayload(payload);
  const { account_kind, account_label } = deriveAccountKindAndLabel(profile.identity_provider);
  const out: AuthProfileEnrichment = {
    account_kind,
    account_label,
  };
  if (profile.preferred_username !== undefined) out.preferred_username = profile.preferred_username;
  if (profile.name !== undefined) out.name = profile.name;
  if (profile.given_name !== undefined) out.given_name = profile.given_name;
  if (profile.family_name !== undefined) out.family_name = profile.family_name;
  if (profile.email !== undefined) out.email = profile.email;
  if (profile.email_verified !== undefined) out.email_verified = profile.email_verified;
  if (profile.identity_provider !== undefined) out.identity_provider = profile.identity_provider;
  return out;
}
