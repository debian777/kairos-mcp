# Security Documentation

## Authentication Implementation

This document describes the OIDC/OAuth2 bearer token authentication implementation and threat mitigations.

### Overview

The KAIROS MCP server implements stateless bearer token authentication using JWT tokens from trusted OIDC/OAuth2 identity providers (IdPs). Authentication is enforced on sensitive endpoints (`POST /mcp` and all `/api/*` routes) while public endpoints (`GET /health` and `GET /`) remain accessible without authentication.

### Threat Mitigations

#### 1. Token Passthrough Prevention

**Threat**: An attacker could intercept a valid token and reuse it to access protected resources.

**Mitigation**:
- Tokens are validated on every request (stateless authentication)
- Token expiration (`exp` claim) is strictly enforced
- Token not-before (`nbf` claim) prevents token reuse before the intended time
- JWKS-based signature verification ensures tokens cannot be forged
- No token storage or caching on the server side

#### 2. Confused Deputy Problem

**Threat**: A token issued for one service could be used against another service if audience validation is weak.

**Mitigation**:
- Strict audience (`aud` claim) validation against a configured allowlist
- Each token must include an allowed audience in its `aud` claim
- Multiple audiences can be configured to support different client applications

#### 3. Scope Minimization

**Threat**: A token with broad permissions could be used to access resources beyond its intended scope.

**Mitigation**:
- Per-route scope requirements (configurable via `AUTH_REQUIRED_SCOPES_MCP` and `AUTH_REQUIRED_SCOPES_API`)
- Token must contain ALL required scopes for the requested endpoint
- Scope validation is enforced after token signature and claims validation
- Missing required scopes result in 403 Forbidden (not 401 Unauthorized)

#### 4. Token Forgery

**Threat**: An attacker could forge tokens without access to the IdP's private key.

**Mitigation**:
- JWKS (JSON Web Key Set) fetched from trusted issuers
- JWKS cached with TTL to balance security and performance
- RSA256 signature verification using public keys from JWKS
- Issuer (`iss` claim) must match a configured trusted issuer
- Tokens with invalid signatures are rejected with 401 Unauthorized

#### 5. Key Rotation

**Threat**: Compromised private keys could be used to issue valid tokens indefinitely.

**Mitigation**:
- JWKS cache has configurable TTL (`AUTH_JWKS_CACHE_TTL`, default 1 hour)
- Cache refresh on expiration ensures new keys are fetched
- Support for multiple trusted issuers allows gradual key rotation
- IdP key rotation is transparent to clients (JWKS automatically updates)

#### 6. Information Leakage

**Threat**: Error messages or logs could leak sensitive information about tokens or authentication failures.

**Mitigation**:
- Generic error messages for authentication failures (401/403)
- No token content logged (only subject, issuer, scopes, and path)
- Token values are never included in logs or error responses
- Failed authentication attempts are logged at warning level without token details

#### 7. Replay Attacks

**Threat**: An attacker could replay a valid token after it has been used.

**Mitigation**:
- Stateless design means tokens can be used multiple times until expiration
- Short token expiration times recommended (configured at IdP level)
- `nbf` claim prevents token use before intended time
- For additional protection, implement token revocation at the IdP level

### Configuration

Authentication is configured via environment variables:

- `AUTH_ENABLED`: Enable/disable authentication (default: `false`)
- `AUTH_TRUSTED_ISSUERS`: Comma-separated list of trusted issuer URLs
- `AUTH_ALLOWED_AUDIENCES`: Comma-separated list of allowed audience values
- `AUTH_REQUIRED_SCOPES_MCP`: Required scopes for `POST /mcp` (default: `mcp:access`)
- `AUTH_REQUIRED_SCOPES_API`: Required scopes for `/api/*` routes (default: `api:access`)
- `AUTH_JWKS_CACHE_TTL`: JWKS cache TTL in seconds (default: `3600`)

### Multi-Issuer Support

The implementation supports multiple trusted issuers, allowing:
- Different IdPs for different clients (e.g., Google, Apple, Okta)
- Gradual migration between IdPs
- High availability (if one IdP is down, others can still authenticate)

Each issuer must:
- Provide a JWKS endpoint at `{issuer}/.well-known/jwks.json`
- Issue tokens with valid `iss`, `aud`, `exp`, and `nbf` claims
- Use RS256 algorithm for token signing

### Best Practices

1. **Token Expiration**: Configure short token lifetimes at the IdP (e.g., 1 hour)
2. **Scope Granularity**: Use fine-grained scopes (e.g., `mcp:read`, `mcp:write`, `api:read`, `api:write`)
3. **Audience Validation**: Use specific audience values per client application
4. **JWKS Cache TTL**: Balance security (shorter TTL) with performance (longer TTL)
5. **Monitoring**: Monitor authentication failures (401/403) for potential attacks
6. **Key Rotation**: Coordinate with IdP administrators for regular key rotation

### Limitations

- **Stateless Design**: Tokens cannot be revoked server-side (rely on expiration and IdP revocation)
- **No Token Introspection**: The server does not call IdP introspection endpoints (relies on JWT validation)
- **JWKS Dependency**: Server requires network access to IdP JWKS endpoints (consider caching for offline scenarios)

### Future Enhancements

Potential improvements for future versions:
- Token introspection endpoint support for real-time revocation
- Rate limiting per authenticated subject
- Audit logging for all authentication events
- Support for additional signature algorithms (ES256, PS256)
- Token binding to prevent token theft
