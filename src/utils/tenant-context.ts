/**
 * Extract tenant_id from request context.
 * 
 * CURRENT: Returns 'default' for single-tenant deployments.
 * FUTURE: Will extract from OAuth tokens, API keys, or headers when multi-tenant is implemented.
 * 
 * See docs/multi-user.md for future multi-tenant architecture.
 */

/**
 * Get tenant ID from request context.
 * 
 * CURRENT: Returns 'default' for single-tenant deployments.
 * FUTURE: Will accept request parameter and extract from OAuth tokens, API keys, or headers when multi-tenant is implemented.
 * 
 * @returns Tenant ID (defaults to 'default' for single-tenant)
 */
export function getTenantId(): string {
  // TODO: When multi-tenant is implemented, add request parameter and extraction logic:
  // - X-Tenant-ID header (for API key requests)
  // - OAuth token claims (for authenticated users)
  // - Request metadata (for MCP requests)
  
  // For now, always return default for single-tenant
  return process.env['DEFAULT_TENANT_ID'] || 'default';
}

