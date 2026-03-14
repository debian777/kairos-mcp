/**
 * Centralized configuration for environment variables.
 * This file contains all environment variable parsing logic.
 * REDIS_URL: when set (non-empty) → Redis backend; when unset or empty → in-memory backend. QDRANT_URL is always required.
 */

import path from 'path';

/** Throws if key is missing or empty (after trim). Use for vars that must be set. */
function getEnvRequired(key: string, errorMessage?: string): string {
  const val = process.env[key];
  const trimmed = typeof val === 'string' ? val.trim() : '';
  if (!trimmed) {
    const msg = errorMessage ?? `KAIROS requires ${key} to be set. Set it in .env or environment.`;
    throw new Error(msg);
  }
  return trimmed;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const low = String(val).trim().toLowerCase();
  if (low === 'false' || low === '0' || low === 'no' || low === 'n') return false;
  if (low === 'true' || low === '1' || low === 'yes' || low === 'y') return true;
  return defaultValue;
}

// REDIS_URL set (non-empty) → Redis; unset or empty → in-memory backend
export const REDIS_URL = (getEnvString('REDIS_URL', '')).trim();
export const USE_REDIS = REDIS_URL.length > 0;
export const KAIROS_REDIS_PREFIX = getEnvString('KAIROS_REDIS_PREFIX', 'kairos:');
/** Memory cache key prefix; keys starting with this are global (no space namespace). One key per UUID. */
export const MEMORY_CACHE_KEY_PREFIX = 'mem:';
export const OPENAI_EMBEDDING_MODEL = getEnvString('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
/** Base URL for OpenAI API (e.g. https://api.openai.com or Azure endpoint). No trailing slash. */
export const OPENAI_API_URL = getEnvString('OPENAI_API_URL', 'https://api.openai.com').replace(/\/$/, '');
export const OPENAI_API_KEY = getEnvString('OPENAI_API_KEY', '');
export const EMBEDDING_PROVIDER = getEnvString('EMBEDDING_PROVIDER', 'auto');
export const TEI_BASE_URL = getEnvString('TEI_BASE_URL', '');
export const TEI_MODEL = getEnvString('TEI_MODEL', 'Alibaba-NLP/gte-large-en-v1.5');
export const TEI_API_KEY = getEnvString('TEI_API_KEY', '');
export const LOG_LEVEL = getEnvString('LOG_LEVEL', 'info');
export const LOG_FORMAT = getEnvString('LOG_FORMAT', 'text');
export const QDRANT_API_KEY = getEnvString('QDRANT_API_KEY', '');
export const QDRANT_COLLECTION_CURRENT = getEnvString('QDRANT_COLLECTION_CURRENT', '');
export const KAIROS_SEARCH_OVERFETCH_FACTOR = getEnvString('KAIROS_SEARCH_OVERFETCH_FACTOR', '4');
export const KAIROS_SEARCH_MAX_FETCH = getEnvInt('KAIROS_SEARCH_MAX_FETCH', 200);
/** Default number of match choices returned by kairos_search when agent omits max_choices. */
export const KAIROS_SEARCH_MAX_CHOICES = getEnvInt('KAIROS_SEARCH_MAX_CHOICES', 10);
/** Absolute cap for kairos_search max_choices (prevents abuse and excessive resolveHead latency). */
export const KAIROS_SEARCH_LIMIT_CAP = getEnvInt('KAIROS_SEARCH_LIMIT_CAP', 50);
/** Minimum match choices when agent passes max_choices. */
export const KAIROS_SEARCH_LIMIT_MIN = getEnvInt('KAIROS_SEARCH_LIMIT_MIN', 5);
export const KAIROS_ENABLE_GROUP_COLLAPSE = getEnvBoolean('KAIROS_ENABLE_GROUP_COLLAPSE', true);

// Auth (Keycloak OIDC). One Keycloak per env: each env file sets KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID.
// When AUTH_ENABLED=true these must be set (no empty string); startup will throw otherwise.
export const AUTH_ENABLED = getEnvBoolean('AUTH_ENABLED', false);
export const KEYCLOAK_URL = getEnvString('KEYCLOAK_URL', '');
/** When set, used for server-side calls (e.g. token exchange). When unset, KEYCLOAK_URL is used. Use keycloak:8080 in Docker. */
export const KEYCLOAK_INTERNAL_URL = getEnvString('KEYCLOAK_INTERNAL_URL', '');
export const KEYCLOAK_REALM = getEnvString('KEYCLOAK_REALM', 'kairos-dev');
export const KEYCLOAK_CLIENT_ID = getEnvString('KEYCLOAK_CLIENT_ID', 'kairos-mcp');
/** CLI browser login: public client ID (e.g. kairos-cli). Overridable at runtime by KAIROS_CLIENT_ID. */
export const KEYCLOAK_CLI_CLIENT_ID = getEnvString('KEYCLOAK_CLI_CLIENT_ID', 'kairos-cli');
/** Base URL for redirect_uri (e.g. http://localhost:3500). Must match Keycloak client redirect URIs. */
export const AUTH_CALLBACK_BASE_URL = getEnvString('AUTH_CALLBACK_BASE_URL', '');
export const SESSION_SECRET = getEnvString('SESSION_SECRET', '');
/** Session cookie and payload exp lifetime in seconds; default 7 days. */
export const SESSION_MAX_AGE_SEC = getEnvInt('SESSION_MAX_AGE_SEC', 604800);

/** When set to oidc_bearer, Bearer tokens are validated (issuer, audience, exp); when unset, Bearer presence only (backward compat). */
export const AUTH_MODE = getEnvString('AUTH_MODE', '');
/** Comma-separated list of trusted JWT issuers (e.g. http://keycloak:8080/realms/kairos-dev). Required when AUTH_MODE=oidc_bearer. */
export const AUTH_TRUSTED_ISSUERS_STRING = getEnvString('AUTH_TRUSTED_ISSUERS', '');
/** Comma-separated list of allowed JWT audiences (e.g. kairos-mcp). Required when AUTH_MODE=oidc_bearer. */
export const AUTH_ALLOWED_AUDIENCES_STRING = getEnvString('AUTH_ALLOWED_AUDIENCES', '');

// Int configurations
export const PORT = getEnvInt('PORT', 3000);

if (AUTH_ENABLED) {
  const missing: string[] = [];
  if (!KEYCLOAK_URL.trim()) missing.push('KEYCLOAK_URL');
  if (!KEYCLOAK_REALM.trim()) missing.push('KEYCLOAK_REALM');
  if (!KEYCLOAK_CLIENT_ID.trim()) missing.push('KEYCLOAK_CLIENT_ID');
  if (!AUTH_CALLBACK_BASE_URL.trim()) missing.push('AUTH_CALLBACK_BASE_URL');
  if (!SESSION_SECRET.trim()) missing.push('SESSION_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `AUTH_ENABLED=true requires non-empty env: ${missing.join(', ')}. Set them in .env. See docs/install/README.md.`
    );
  }
}
export const QDRANT_RESCORE_STRING = getEnvString('QDRANT_RESCORE', 'true');
/** When non-empty, backup/snapshot is enabled; app creates dir if missing. Empty = not configured → 503 on POST /api/snapshot. */
export const QDRANT_SNAPSHOT_ON_START = getEnvBoolean('QDRANT_SNAPSHOT_ON_START', false);
const QDRANT_SNAPSHOT_DIR_RAW = getEnvString('QDRANT_SNAPSHOT_DIR', '').trim();
export const QDRANT_SNAPSHOT_DIR =
  QDRANT_SNAPSHOT_DIR_RAW === ''
    ? ''
    : path.isAbsolute(QDRANT_SNAPSHOT_DIR_RAW)
      ? QDRANT_SNAPSHOT_DIR_RAW
      : path.resolve(QDRANT_SNAPSHOT_DIR_RAW);

// Int configurations
export const METRICS_PORT = getEnvInt('METRICS_PORT', 9090);
/** Raw env: positive = override, -1 = disabled, 0 or unset = auto-detect from cgroup/memory. */
export const MAX_CONCURRENT_MCP_REQUESTS_RAW = getEnvInt('MAX_CONCURRENT_MCP_REQUESTS', 0);

// Float configurations (tunable via env; relaxed defaults so more results pass into choices)
export const SCORE_THRESHOLD = getEnvFloat('SCORE_THRESHOLD', 0.3);
/** Mint: score >= this value triggers SIMILAR_MEMORY_FOUND. Set SIMILAR_MEMORY_THRESHOLD=1 to effectively disable. */
export const SIMILAR_MEMORY_THRESHOLD = getEnvFloat('SIMILAR_MEMORY_THRESHOLD', 0.9);

/** Attest boost: below this many runs we do not apply boost. */
export const MIN_ATTEST_RUNS = getEnvInt('MIN_ATTEST_RUNS', 3);
/** Attest boost: at this many runs confidence is 1. */
export const RUNS_FULL_CONFIDENCE = getEnvInt('RUNS_FULL_CONFIDENCE', 10);
/** Max additive boost from attest (tiebreaker within RRF bands). */
export const ATTEST_BOOST_MAX = getEnvFloat('ATTEST_BOOST_MAX', 0.08);

// Transport: stdio | http. Logging and server use this single source.
const TRANSPORT_TYPE_RAW = getEnvString('TRANSPORT_TYPE', 'stdio');
export const TRANSPORT_TYPE: 'stdio' | 'http' =
  TRANSPORT_TYPE_RAW === 'http' ? 'http' : 'stdio';

// Required (throw at startup if missing)
export function getQdrantUrl(): string {
  return getEnvRequired('QDRANT_URL');
}

export function getQdrantCollection(defaultValue = 'kairos'): string {
  return getEnvString('QDRANT_COLLECTION', defaultValue);
}

// Trusted issuers: from env, or from KEYCLOAK_URL/REALM when unset. Add loopback alias (localhost <-> 127.0.0.1) so tokens match either.
const _authIssuersFromEnv = AUTH_TRUSTED_ISSUERS_STRING.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const _authIssuersBase =
  _authIssuersFromEnv.length > 0
    ? _authIssuersFromEnv
    : KEYCLOAK_URL && KEYCLOAK_REALM
      ? [`${KEYCLOAK_URL.replace(/\/$/, '')}/realms/${KEYCLOAK_REALM}`]
      : [];
const _authIssuersExpanded: string[] = [];
for (const iss of _authIssuersBase) {
  _authIssuersExpanded.push(iss);
  if (iss.includes('localhost')) {
    const other = iss.replace(/localhost/g, '127.0.0.1');
    if (!_authIssuersExpanded.includes(other)) _authIssuersExpanded.push(other);
  } else if (iss.includes('127.0.0.1')) {
    const other = iss.replace(/127\.0\.0\.1/g, 'localhost');
    if (!_authIssuersExpanded.includes(other)) _authIssuersExpanded.push(other);
  }
}
export const AUTH_TRUSTED_ISSUERS = _authIssuersExpanded;

// Allowed audiences: from env if set (explicit config wins), or default to server + CLI client IDs + account.
// If AUTH_ALLOWED_AUDIENCES is explicitly set, use it as-is (no magic injection).
const _authAudFromEnv = AUTH_ALLOWED_AUDIENCES_STRING.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const _authAudDefault: string[] = [];
if (KEYCLOAK_CLIENT_ID) _authAudDefault.push(KEYCLOAK_CLIENT_ID);
if (KEYCLOAK_CLI_CLIENT_ID && KEYCLOAK_CLI_CLIENT_ID !== KEYCLOAK_CLIENT_ID) {
  _authAudDefault.push(KEYCLOAK_CLI_CLIENT_ID);
}
const _authAudBase = _authAudFromEnv.length > 0 ? _authAudFromEnv : _authAudDefault;
// Add "account" for Keycloak access tokens when we have realm issuers
const _hasKeycloakRealm = _authIssuersBase.some((u) => u.includes('/realms/'));
export const AUTH_ALLOWED_AUDIENCES =
  _hasKeycloakRealm && !_authAudBase.includes('account')
    ? [..._authAudBase, 'account']
    : _authAudBase;
/** Space for embedded mem docs and default when AUTH_ENABLED=false. Included in search scope for all users. Must follow space model (e.g. space:kairos-app). */
export const KAIROS_APP_SPACE_ID = getEnvString('KAIROS_APP_SPACE_ID', 'space:kairos-app');