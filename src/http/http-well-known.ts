/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for MCP authorization discovery.
 *
 * Serves metadata at:
 *   GET /.well-known/oauth-protected-resource       (root — fallback)
 *   GET /.well-known/oauth-protected-resource/mcp   (path-specific — tried first by spec-compliant clients)
 *
 * MCP clients use this to discover the authorization server and initiate OAuth 2.1 flows.
 * See: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
import type { Express, Request, Response } from 'express';
import { AUTH_CALLBACK_BASE_URL, KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLI_CLIENT_ID } from '../config.js';
import { structuredLogger } from '../utils/structured-logger.js';

function buildProtectedResourceMetadata(): Record<string, unknown> {
  const base = AUTH_CALLBACK_BASE_URL.replace(/\/$/, '');
  const resource = `${base}/mcp`;
  const issuer = KEYCLOAK_URL
    ? `${KEYCLOAK_URL.replace(/\/$/, '')}/realms/${KEYCLOAK_REALM}`
    : '';

  const metadata: Record<string, unknown> = {
    resource,
    authorization_servers: issuer ? [issuer] : [],
    scopes_supported: ['openid', 'profile', 'email'],
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
}
