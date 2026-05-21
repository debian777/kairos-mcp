import type { Response } from 'express';
import {
  AUTH_CALLBACK_BASE_URL,
  OIDC_SCOPES_SUPPORTED,
  KEYCLOAK_URL,
  KEYCLOAK_REALM
} from '../config.js';

/** Escape RFC 7230 quoted-string content for WWW-Authenticate (backslashes and DQUOTE). */
function escapeWwwAuthenticateQuotedValue(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n\x00]/g, ' ');
}

/** Build WWW-Authenticate value. Use error=invalid_token so MCP clients clear stored token and restart OAuth (e.g. after Keycloak session cleanup). */
export function buildWwwAuthenticate(opts?: { error?: 'invalid_token'; error_description?: string }): string {
  if (!AUTH_CALLBACK_BASE_URL) return '';
  const base = AUTH_CALLBACK_BASE_URL.replace(/\/$/, '');
  const resourceMetadataUrl = `${base}/.well-known/oauth-protected-resource`;
  const keycloakBase = KEYCLOAK_URL ? KEYCLOAK_URL.replace(/\/$/, '') : '';
  const authorizationServerMetadataUrl = keycloakBase
    ? `${keycloakBase}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`
    : '';
  const scopeValue = (OIDC_SCOPES_SUPPORTED || []).join(' ').trim();
  const parts = [
    `Bearer realm="mcp"`,
    `resource_metadata="${resourceMetadataUrl}"`
  ];
  if (authorizationServerMetadataUrl) {
    parts.push(`authorization_uri="${authorizationServerMetadataUrl}"`);
  }
  if (scopeValue) parts.push(`scope="${escapeWwwAuthenticateQuotedValue(scopeValue)}"`);
  if (opts?.error) {
    parts.push(`error="${opts.error}"`);
    if (opts.error_description) {
      parts.push(`error_description="${escapeWwwAuthenticateQuotedValue(opts.error_description)}"`);
    }
  }
  return parts.join(', ');
}

export function setWwwAuthenticate(res: Response, opts?: { error?: 'invalid_token'; error_description?: string }): void {
  const value = buildWwwAuthenticate(opts);
  if (value) res.setHeader('WWW-Authenticate', value);
}
