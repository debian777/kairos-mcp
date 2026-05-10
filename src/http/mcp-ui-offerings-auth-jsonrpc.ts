import { MCP_SSO_REAUTH_NEXT_STEP } from './http-auth-middleware.js';
import { safeCreateOidcLoginUrlForApiResponse } from './http-auth-oidc-redirect.js';

/** JSON-RPC body for `listOfferingsForUI` when auth is required (machine-actionable remediation). */
export function buildListOfferingsUnauthorizedJsonRpc(id: unknown): Record<string, unknown> {
  const loginUrl = safeCreateOidcLoginUrlForApiResponse();
  return {
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Authentication required for UI offerings',
      data: {
        reauth_required: true,
        next_step: MCP_SSO_REAUTH_NEXT_STEP,
        ...(loginUrl ? { login_url: loginUrl } : {})
      }
    },
    id
  };
}
