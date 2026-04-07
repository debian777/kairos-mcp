/**
 * OAuth 2.0 well-known metadata endpoints for MCP authorization discovery.
 *
 * Protected Resource Metadata (RFC 9728):
 *   GET /.well-known/oauth-protected-resource       (root - fallback)
 *   GET /.well-known/oauth-protected-resource/mcp   (path-specific - tried first by spec-compliant clients)
 *
 * Authorization Server Metadata (RFC 8414 proxy):
 *   GET /.well-known/oauth-authorization-server
 *
 *   Proxies Keycloak's realm OpenID configuration. registration_endpoint is preserved so
 *   MCP hosts that require Dynamic Client Registration (e.g. Cursor streamable HTTP) work.
 *   Adds client_id_metadata_document_supported: true (MCP spec 2025-11-25) so clients that
 *   support Client ID Metadata Documents can prefer them over DCR when applicable.
 *   Operators should constrain DCR in Keycloak realm settings if client sprawl is a concern.
 *
 * See: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
import type { Express, Request, Response } from 'express';
import { AUTH_CALLBACK_BASE_URL, KEYCLOAK_URL, KEYCLOAK_INTERNAL_URL, KEYCLOAK_REALM, KEYCLOAK_CLI_CLIENT_ID } from '../config.js';
import { structuredLogger } from '../utils/structured-logger.js';

export function buildProtectedResourceMetadata(): Record<string, unknown> {
  const base = AUTH_CALLBACK_BASE_URL.replace(/\/$/, '');
  const resource = `${base}/mcp`;
  const issuer = KEYCLOAK_URL
    ? `${KEYCLOAK_URL.replace(/\/$/, '')}/realms/${KEYCLOAK_REALM}`
    : '';

  const metadata: Record<string, unknown> = {
    resource,
    authorization_servers: issuer ? [issuer] : [],
    scopes_supported: ['openid', 'profile', 'email', 'kairos-groups'],
    bearer_methods_supported: ['header'],
    resource_name: 'KAIROS MCP'
  };
  if (issuer) {
    metadata['authorization_endpoint'] = `${issuer}/protocol/openid-connect/auth`;
    metadata['token_endpoint'] = `${issuer}/protocol/openid-connect/token`;
  }
  metadata['authorization_request_parameters'] = { prompt: 'login' };
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

  setupAuthorizationServerMetadata(app);
}

// ---------------------------------------------------------------------------
// Authorization Server Metadata proxy (RFC 8414)
// ---------------------------------------------------------------------------

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

export function buildAuthorizationServerMetadata(upstream: Record<string, unknown>): Record<string, unknown> {
  const metadata = { ...upstream };

  // Preserve registration_endpoint from Keycloak — MCP hosts (e.g. Cursor streamable HTTP)
  // require it for Dynamic Client Registration. Stripping it causes:
  //   "Incompatible auth server: does not support dynamic client registration"
  // Operators should constrain DCR in Keycloak realm settings if client sprawl is a concern.

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
