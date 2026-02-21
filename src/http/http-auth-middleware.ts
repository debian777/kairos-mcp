/**
 * OIDC/OAuth2 Bearer Token Authentication Middleware
 * 
 * Validates JWT bearer tokens from multiple trusted issuers using JWKS.
 * Enforces scope requirements and attaches auth context to requests.
 */

import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { structuredLogger } from '../utils/structured-logger.js';
import {
    AUTH_ENABLED,
    AUTH_TRUSTED_ISSUERS,
    AUTH_ALLOWED_AUDIENCES,
    AUTH_REQUIRED_SCOPES_MCP,
    AUTH_REQUIRED_SCOPES_API,
    AUTH_JWKS_CACHE_TTL
} from '../config.js';

/**
 * Auth context attached to authenticated requests
 */
export interface AuthContext {
    subject: string; // sub claim
    issuer: string; // iss claim
    scopes: string[]; // scope claim (space-separated string parsed to array)
    audience: string | string[]; // aud claim
    tenant?: string; // Optional tenant derived from token claims
    [key: string]: unknown; // Allow other claims
}

/**
 * Extend Express Request to include auth context
 */
declare global {
    namespace Express {
        interface Request {
            auth?: AuthContext;
        }
    }
}

/**
 * JWKS cache per issuer
 */
interface JWKSCacheEntry {
    jwks: ReturnType<typeof createRemoteJWKSet>;
    expiresAt: number;
}

const jwksCache = new Map<string, JWKSCacheEntry>();

/**
 * Get or create JWKS for an issuer with caching
 */
function getJWKSForIssuer(issuer: string): ReturnType<typeof createRemoteJWKSet> {
    const cached = jwksCache.get(issuer);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
        return cached.jwks;
    }

    // Build JWKS URI from issuer (OIDC discovery)
    // For standard OIDC providers, JWKS is at {issuer}/.well-known/jwks.json
    let jwksUri: string;
    try {
        const issuerUrl = new URL(issuer);
        jwksUri = `${issuerUrl.origin}/.well-known/jwks.json`;
    } catch {
        // If issuer is not a URL, try appending standard path
        jwksUri = `${issuer}/.well-known/jwks.json`;
    }

    const jwks = createRemoteJWKSet(new URL(jwksUri));
    
    jwksCache.set(issuer, {
        jwks,
        expiresAt: now + (AUTH_JWKS_CACHE_TTL * 1000)
    });

    return jwks;
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7).trim();
}

/**
 * Parse scope string (space-separated) into array
 */
function parseScopes(scopeString?: string): string[] {
    if (!scopeString || typeof scopeString !== 'string') {
        return [];
    }
    return scopeString.split(/\s+/).filter(Boolean);
}

/**
 * Check if token has required scopes
 */
function hasRequiredScopes(tokenScopes: string[], requiredScopes: string): boolean {
    if (!requiredScopes) {
        return true; // No scope requirement
    }
    const required = requiredScopes.split(/\s+/).filter(Boolean);
    if (required.length === 0) {
        return true;
    }
    // Token must have all required scopes
    return required.every(scope => tokenScopes.includes(scope));
}

/**
 * Verify JWT token and extract claims
 */
async function verifyToken(token: string): Promise<{ payload: JWTPayload; issuer: string } | null> {
    // Decode without verification first to get issuer
    let unverifiedPayload: JWTPayload;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        const payloadPart = parts[1];
        const decoded = Buffer.from(payloadPart, 'base64url').toString('utf-8');
        unverifiedPayload = JSON.parse(decoded) as JWTPayload;
    } catch {
        return null;
    }

    const issuer = unverifiedPayload.iss;
    if (!issuer || typeof issuer !== 'string') {
        return null;
    }

    // Check if issuer is trusted
    if (!AUTH_TRUSTED_ISSUERS.includes(issuer)) {
        return null;
    }

    // Get JWKS for this issuer
    const jwks = getJWKSForIssuer(issuer);

    // Verify token
    try {
        const { payload } = await jwtVerify(token, jwks, {
            issuer,
            audience: AUTH_ALLOWED_AUDIENCES.length > 0 ? AUTH_ALLOWED_AUDIENCES : undefined,
            // jose library automatically validates exp and nbf
        });

        return { payload, issuer };
    } catch (error) {
        // Log error but don't leak sensitive details
        structuredLogger.warn('JWT verification failed', {
            issuer,
            error: error instanceof Error ? error.message : 'unknown error'
        });
        return null;
    }
}

/**
 * Create auth context from verified token payload
 */
function createAuthContext(payload: JWTPayload, issuer: string): AuthContext {
    const scopes = parseScopes(payload.scope as string | undefined);
    
    // Derive tenant from token if available (common patterns: tenant_id, tid, or from sub)
    let tenant: string | undefined;
    if (payload.tenant_id && typeof payload.tenant_id === 'string') {
        tenant = payload.tenant_id;
    } else if (payload.tid && typeof payload.tid === 'string') {
        tenant = payload.tid;
    }

    return {
        subject: (payload.sub as string) || 'unknown',
        issuer,
        scopes,
        audience: payload.aud || 'unknown',
        tenant,
        ...payload // Include all other claims
    };
}

/**
 * Authentication middleware factory
 * @param requiredScopes Space-separated list of required scopes (empty string = no requirement)
 */
export function createAuthMiddleware(requiredScopes: string = '') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Skip if auth is disabled
        if (!AUTH_ENABLED) {
            return next();
        }

        // Extract bearer token
        const token = extractBearerToken(req);
        if (!token) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Expected: Bearer <token>'
            });
            return;
        }

        // Verify token
        const verificationResult = await verifyToken(token);
        if (!verificationResult) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
            return;
        }

        const { payload, issuer } = verificationResult;
        const authContext = createAuthContext(payload, issuer);

        // Check scopes
        if (!hasRequiredScopes(authContext.scopes, requiredScopes)) {
            res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions. Required scopes: ' + requiredScopes
            });
            return;
        }

        // Attach auth context to request
        req.auth = authContext;

        // Log authentication (mask token)
        structuredLogger.info('Authenticated request', {
            subject: authContext.subject,
            issuer: authContext.issuer,
            scopes: authContext.scopes,
            path: req.path,
            method: req.method
        });

        next();
    };
}

/**
 * Middleware to protect MCP endpoint
 */
export const mcpAuthMiddleware = createAuthMiddleware(AUTH_REQUIRED_SCOPES_MCP);

/**
 * Middleware to protect API routes
 */
export const apiAuthMiddleware = createAuthMiddleware(AUTH_REQUIRED_SCOPES_API);
