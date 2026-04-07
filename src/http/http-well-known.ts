/**
 * OAuth 2.0 well-known metadata endpoints for MCP authorization discovery.
 *
 * Protected Resource Metadata (RFC 9728):
 *   GET /.well-known/oauth-protected-resource       (root — fallback)
 *   GET /.well-known/oauth-protected-resource/mcp   (path-specific — tried first by spec-compliant clients)
 *
 * Authorization Server Metadata (RFC 8414 proxy):
 *   GET /.well-known/oauth-authorization-server
 *
 *   Proxies Keycloak's authorization server metadata with two critical overrides:
 *   1. Strips `registration_endpoint` — prevents MCP clients from using Dynamic Client
 *      Registration (RFC 7591), which creates a new Keycloak client per session and causes
 *      unbounded client sprawl (100+ orphaned clients observed in production).
 *   2. Adds `client_id_metadata_document_supported: true` — signals MCP clients (spec 2025-11-25)
 *      to use Client ID Metadata Documents instead of DCR.
 *
 *   MCP client fallback priority (spec 2025-11-25):
 *     1. Pre-registered client info (kairos-cli exposed via kairos_cli_client_id)
 *     2. Client ID Metadata Documents (when client_id_metadata_document_supported is true)
 *     3. DCR (only when registration_endpoint is present — we strip it)
 *     4. User prompt
 *
 * See: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
import type { Express, Request, Response } from 'express';
import { AUTH_CALLBACK_BASE_URL, KEYCLOAK_URL, KEYCLOAK_INTERNAL_URL, KEYCLOAK_REALM, KEYCLOAK_CLI_CLIENT_ID } from '../config.js';
import { structuredLogger } from '../utils/structured-logger.js';

function buildProtectedResourceMetadata(): Record<string, unknown> {
  const base = AUTH_CALLBACK_BASE_URL.replace(/\/$/, '');
  const resource = `${base}/mcp`;
  const issuer = KEYCLOAK_URL
    ? `${KEYCLOAK_URL.replace(/\/$/, '')}/realms/${KEYCLOAK_REALM}`
    : '';

  // Point authorization_servers to KAIROS itself (not Keycloak directly).
  // KAIROS serves /.well-known/oauth-authorization-server as a filtered proxy of Keycloak's
  // metadata — stripping registration_endpoint to prevent DCR client sprawl.
  // MCP clients discover auth capabilities from KAIROS, but auth/token endpoints in the
  // proxied metadata still point to Keycloak for the actual OAuth flows.
  const metadata: Record<string, unknown> = {
    resource,
    authorization_servers: base ? [base] : issuer ? [issuer] : [],
    scopes_supported: ['openid', 'profile', 'email', 'kairos-groups'],
    bearer_methods_supported: ['header'],
    resource_name: 'KAIROS MCP'
  };
  // Optional: expose endpoints so CLI and other clients can build auth URLs without 401 or hardcoded paths.
  if (issuer) {
    metadata['authorization_endpoint'] = `${issuer}/protocol/openid-connect/auth`;
    metadata['token_endpoint'] = `${issuer}/protocol/openid-connect/token`;
  }
  // RFC 9728 allows additional parameters. MCP clients that support it should add these
  // to the authorization request (e.g. prompt=login) to avoid already_logged_in when
  // the user is logged in elsewhere, without disabling SSO for normal browser use.
  metadata['authorization_request_parameters'] = { prompt: 'login' };
  // KAIROS-specific extension: expose the public client_id for PKCE flows (CLI and MCP hosts)
  if (KEYCLOAK_CLI_CLIENT_ID) {
    metadata['kairos_cli_client_id'] = KEYCLOAK_CLI_CLIENT_ID;
  }
  return metadata;
}

export function setupWellKnown(app: Express): void {
  if (!AUTH_CALLBACK_BASE_URL) {
    structuredLogger.warn(
      '[well-known] AUTH_CALLBACK_BASE_URL is empty — Protected Resource Metadata will use relative URIs (non-compliant with RFC 9728). Set AUTH_CALLBACK_BASE_URL for production.'
    );
  }

  const handler = (_req: Request, res: Response) => {
    res.json(buildProtectedResourceMetadata());
  };

  app.get('/.well-known/oauth-protected-resource', handler);
  app.get('/.well-known/oauth-protected-resource/mcp', handler);

  // Authorization Server Metadata — proxy from Keycloak with DCR stripped.
  setupAuthorizationServerMetadata(app);
}

// ---------------------------------------------------------------------------
// Authorization Server Metadata proxy (RFC 8414)
// ---------------------------------------------------------------------------

/** Fields stripped from Keycloak metadata to prevent MCP clients from using DCR. */
const STRIPPED_FIELDS = ['registration_endpoint'] as const;

/** Cache upstream metadata to avoid per-request round-trips. */
let authServerMetadataCache: { data: Record<string, unknown>; expiresAt: number } | null = null;
const AUTH_SERVER_METADATA_CACHE_SEC = 300; // 5 min

/**
 * Resolve the Keycloak base URL for server-side fetches (Docker: use internal URL).
 * Same logic as bearer-validate.ts resolveOidcIssuerBaseForServerFetch.
 */
function keycloakFetchBase(): string {
  const external = KEYCLOAK_URL ? KEYCLOAK_URL.replace(/\/$/, '') : '';
  if (KEYCLOAK_INTERNAL_URL && external) {
    return KEYCLOAK_INTERNAL_URL.replace(/\/$/, '');
  }
  return external;
}

async function fetchUpstreamAuthServerMetadata(): Promise<Record<string, unknown> | null> {
  const now = Date.now();
  if (authServerMetadataCache && now < authServerMetadataCache.expiresAt) {
    return authServerMetadataCache.data;
  }

  const base = keycloakFetchBase();
  if (!base) return null;

  const url = `${base}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      structuredLogger.warn(`[well-known] upstream auth server metadata HTTP ${res.status} url=${url}`);
      return null;
    }
    const data = (await res.json()) as Record<string, unknown>;
    authServerMetadataCache = { data, expiresAt: now + AUTH_SERVER_METADATA_CACHE_SEC * 1000 };
    return data;
  } catch (err) {
    structuredLogger.warn(
      `[well-known] upstream auth server metadata fetch failed url=${url} err=${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

function buildAuthorizationServerMetadata(upstream: Record<string, unknown>): Record<string, unknown> {
  const metadata = { ...upstream };

  // Strip DCR endpoint to prevent MCP clients from registering new Keycloak clients.
  for (const field of STRIPPED_FIELDS) {
    delete metadata[field];
  }

  // Also strip from mtls_endpoint_aliases (Keycloak mirrors endpoints there).
  const mtls = metadata['mtls_endpoint_aliases'];
  if (mtls && typeof mtls === 'object') {
    const aliases = { ...(mtls as Record<string, unknown>) };
    for (const field of STRIPPED_FIELDS) {
      delete aliases[field];
    }
    metadata['mtls_endpoint_aliases'] = aliases;
  }

  // Signal MCP clients (spec 2025-11-25) that Client ID Metadata Documents are supported.
  // This is position 2 in the MCP client fallback priority, ahead of DCR (position 3).
  metadata['client_id_metadata_document_supported'] = true;

  return metadata;
}

function setupAuthorizationServerMetadata(app: Express): void {
  const handler = async (_req: Request, res: Response) => {
    const upstream = await fetchUpstreamAuthServerMetadata();
    if (!upstream) {
      res.status(502).json({ error: 'authorization_server_unavailable' });
      return;
    }
    res.json(buildAuthorizationServerMetadata(upstream));
  };

  app.get('/.well-known/oauth-authorization-server', handler);
}
