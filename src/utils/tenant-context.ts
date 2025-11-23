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
 * FUTURE: Will extract from OAuth tokens, API keys, or headers when multi-tenant is implemented.
 * 
 * @param request - Optional Express request or global context object
 * @returns Tenant ID (defaults to 'default' for single-tenant)
 */
export function getTenantId(request?: any): string {
  // Try to extract from request if provided
  if (request) {
    // Check for X-Tenant-ID header (for API key requests)
    if (request.headers && request.headers['x-tenant-id']) {
      return String(request.headers['x-tenant-id']);
    }
    // Check for tenant_id in request body/query
    if (request.body && request.body.tenant_id) {
      return String(request.body.tenant_id);
    }
    if (request.query && request.query.tenant_id) {
      return String(request.query.tenant_id);
    }
  }
  
  // Try global context (for MCP requests)
  if (globalThis._mcpRequestContext) {
    const globalReq = globalThis._mcpRequestContext as any;
    if (globalReq.headers && globalReq.headers['x-tenant-id']) {
      return String(globalReq.headers['x-tenant-id']);
    }
  }
  
  // TODO: When multi-tenant is implemented, add:
  // - OAuth token claims (for authenticated users)
  // - Request metadata (for MCP requests)
  
  // For now, always return default for single-tenant
  return process.env['DEFAULT_TENANT_ID'] || 'default';
}

