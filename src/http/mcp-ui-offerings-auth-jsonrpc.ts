import { safeCreateOidcLoginUrlForApiResponse } from './http-auth-oidc-redirect.js';

/**
 * Implementation-defined JSON-RPC error code for authentication-required responses.
 * Range -32000 to -32099 is reserved for implementation-defined server errors per JSON-RPC 2.0 spec.
 */
export const JSONRPC_ERR_AUTH_REQUIRED = -32001;

/** Build a JSON-RPC 2.0 error envelope for unauthenticated requests to /mcp. */
export function buildJsonRpcAuthError(
  id: unknown,
  message: string,
  loginUrl: string | undefined
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    error: {
      code: JSONRPC_ERR_AUTH_REQUIRED,
      message,
      data: {
        error: 'unauthorized',
        reauth_required: true,
        ...(loginUrl ? { login_url: loginUrl } : {})
      }
    },
    id: id ?? null
  };
}

/** JSON-RPC body for `listOfferingsForUI` when auth is required (machine-actionable remediation). */
export function buildListOfferingsUnauthorizedJsonRpc(id: unknown): Record<string, unknown> {
  const loginUrl = safeCreateOidcLoginUrlForApiResponse();
  return buildJsonRpcAuthError(id, 'Authentication required for UI offerings', loginUrl ?? undefined);
}
