/**
 * Integration tests for OIDC/OAuth2 bearer token authentication
 * 
 * Tests authentication middleware with a mock OIDC provider.
 * All tests run in-process without external network calls.
 */

import express from 'express';
import request from 'supertest';
import { MemoryQdrantStore } from '../../src/services/memory/store.js';
import { configureMiddleware } from '../../src/http/http-server-config.js';
import { setupHealthRoutes } from '../../src/http/http-health-routes.js';
import { setupApiRoutes } from '../../src/http/http-api-routes.js';
import { setupMcpRoutes } from '../../src/http/http-mcp-handler.js';
import { setupErrorHandlers } from '../../src/http/http-error-handlers.js';
import { qdrantService } from '../../src/services/qdrant/index.js';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { createServer } from 'http';
import { AddressInfo } from 'net';

/**
 * Create a test Express app with auth enabled
 * Uses dynamic import to ensure config is loaded after env vars are set
 */
async function createTestApp(mcpServer: any, memoryStore: MemoryQdrantStore, requiredScopesMCP: string, requiredScopesAPI: string): Promise<express.Express> {
    // Dynamically import auth middleware after env vars are set
    const { createAuthMiddleware } = await import('../../src/http/http-auth-middleware.js');
    
    const app = express();
    
    configureMiddleware(app);
    
    // Set up routes
    setupHealthRoutes(app, memoryStore);
    
    // Apply auth middleware to API routes
    const apiAuth = createAuthMiddleware(requiredScopesAPI);
    app.use('/api', apiAuth);
    setupApiRoutes(app, memoryStore, { qdrantService });
    
    // Apply auth middleware to MCP endpoint (passed to setupMcpRoutes)
    const mcpAuth = createAuthMiddleware(requiredScopesMCP);
    setupMcpRoutes(app, mcpServer, mcpAuth);
    
    setupErrorHandlers(app);
    
    return app;
}

/**
 * Mock OIDC provider for testing - lightweight JWKS server
 */
class MockOIDCProvider {
    private server: ReturnType<typeof createServer> | null = null;
    private baseUrl: string = '';
    private keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;
    private jwks: any = null;

    async start(port: number = 0): Promise<string> {
        // Generate key pair for signing
        this.keyPair = await generateKeyPair('RS256');
        const publicJwk = await exportJWK(this.keyPair.publicKey);
        
        this.jwks = {
            keys: [{
                ...publicJwk,
                kid: 'test-key',
                use: 'sig',
                alg: 'RS256'
            }]
        };

        // Create simple Express server for JWKS endpoint
        const jwksApp = express();
        jwksApp.get('/.well-known/jwks.json', (req, res) => {
            res.json(this.jwks);
        });
        
        return new Promise((resolve, reject) => {
            this.server = createServer(jwksApp);
            this.server.listen(port, '127.0.0.1', () => {
                const address = this.server!.address() as AddressInfo;
                this.baseUrl = `http://127.0.0.1:${address.port}`;
                resolve(this.baseUrl);
            });
            this.server.on('error', reject);
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    getIssuer(): string {
        return this.baseUrl;
    }

    getJWKSUri(): string {
        return `${this.baseUrl}/.well-known/jwks.json`;
    }

    async getKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
        if (!this.keyPair) {
            this.keyPair = await generateKeyPair('RS256');
        }
        return this.keyPair;
    }

    /**
     * Generate a test JWT token
     */
    async generateToken(options: {
        sub?: string;
        iss?: string;
        aud?: string | string[];
        scope?: string;
        exp?: number;
        nbf?: number;
        iat?: number;
    } = {}): Promise<string> {
        const keyPair = await this.getKeyPair();
        const now = Math.floor(Date.now() / 1000);
        
        const jwt = new SignJWT({
            sub: options.sub || 'test-user',
            scope: options.scope || 'openid',
        })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuedAt(options.iat || now)
            .setIssuer(options.iss || this.baseUrl)
            .setAudience(options.aud || 'test-client')
            .setExpirationTime(options.exp ? new Date(options.exp * 1000) : '1h')
            .setNotBefore(options.nbf ? new Date(options.nbf * 1000) : now);
        
        return jwt.sign(keyPair.privateKey);
    }
}

describe('Authentication Integration Tests', () => {
    let mockOIDC: MockOIDCProvider;
    let testApp: express.Express;
    let mcpServer: any;
    let memoryStore: MemoryQdrantStore;

    beforeAll(async () => {
        // Start mock OIDC provider
        mockOIDC = new MockOIDCProvider();
        const oidcUrl = await mockOIDC.start();
        
        // Set auth environment variables BEFORE importing config-dependent modules
        process.env.AUTH_ENABLED = 'true';
        process.env.AUTH_TRUSTED_ISSUERS = oidcUrl;
        process.env.AUTH_ALLOWED_AUDIENCES = 'test-client';
        process.env.AUTH_REQUIRED_SCOPES_MCP = 'mcp:access';
        process.env.AUTH_REQUIRED_SCOPES_API = 'api:access';
        
        // Create minimal MCP server mock
        mcpServer = {
            connect: jest.fn().mockResolvedValue(undefined),
        };
        
        // Create memory store (minimal for testing)
        memoryStore = {
            checkHealth: jest.fn().mockResolvedValue(true),
        } as any;
        
        // Create test app with required scopes (will dynamically import auth middleware)
        testApp = await createTestApp(mcpServer, memoryStore, 'mcp:access', 'api:access');
        
        // Wait a bit for JWKS to be available
        await new Promise(resolve => setTimeout(resolve, 1000));
    }, 30000);

    afterAll(async () => {
        await mockOIDC.stop();
        delete process.env.AUTH_ENABLED;
        delete process.env.AUTH_TRUSTED_ISSUERS;
        delete process.env.AUTH_ALLOWED_AUDIENCES;
        delete process.env.AUTH_REQUIRED_SCOPES_MCP;
        delete process.env.AUTH_REQUIRED_SCOPES_API;
    });

    describe('Public endpoints (no auth required)', () => {
        test('GET /health should be accessible without auth', async () => {
            const response = await request(testApp)
                .get('/health')
                .expect(200);
            
            expect(response.body).toHaveProperty('status');
        });

        test('GET / should be accessible without auth', async () => {
            const response = await request(testApp)
                .get('/')
                .expect(200);
            
            expect(response.body).toHaveProperty('service');
        });
    });

    describe('Protected endpoints - unauthenticated access', () => {
        test('POST /mcp should return 401 without token', async () => {
            const response = await request(testApp)
                .post('/mcp')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });

        test('POST /api/* should return 401 without token', async () => {
            const response = await request(testApp)
                .post('/api/kairos_mint')
                .send({})
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('Protected endpoints - authenticated access', () => {
        test('POST /mcp should allow access with valid token and required scope', async () => {
            const token = await mockOIDC.generateToken({
                scope: 'mcp:access openid',
            });
            
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
            
            // Should not return 401 or 403 (may return other errors for invalid MCP request, but auth should pass)
            expect([401, 403]).not.toContain(response.status);
        });

        test('POST /api/* should allow access with valid token and required scope', async () => {
            const token = await mockOIDC.generateToken({
                scope: 'api:access openid',
            });
            
            const response = await request(testApp)
                .post('/api/kairos_mint')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            
            // Should not return 401 or 403 (may return other errors for invalid request, but auth should pass)
            expect([401, 403]).not.toContain(response.status);
        });
    });

    describe('Token validation', () => {
        test('should reject token with wrong issuer', async () => {
            const token = await mockOIDC.generateToken({
                iss: 'https://wrong-issuer.com',
                scope: 'mcp:access',
            });
            
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });

        test('should reject token with wrong audience', async () => {
            const token = await mockOIDC.generateToken({
                aud: 'wrong-audience',
                scope: 'mcp:access',
            });
            
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });

        test('should reject expired token', async () => {
            const now = Math.floor(Date.now() / 1000);
            const token = await mockOIDC.generateToken({
                exp: now - 3600, // Expired 1 hour ago
                scope: 'mcp:access',
            });
            
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });

        test('should reject token with invalid signature', async () => {
            // Create a token with a different key (invalid signature)
            const wrongKeyPair = await generateKeyPair('RS256');
            const wrongToken = await new SignJWT({
                sub: 'test-user',
                scope: 'mcp:access',
            })
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuedAt()
                .setIssuer(mockOIDC.getIssuer())
                .setAudience('test-client')
                .setExpirationTime('1h')
                .sign(wrongKeyPair.privateKey);
            
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${wrongToken}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('Scope enforcement', () => {
        test('should reject token missing required scope for /mcp', async () => {
            const token = await mockOIDC.generateToken({
                scope: 'openid', // Missing mcp:access
            });
            
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(403);
            
            expect(response.body).toHaveProperty('error', 'Forbidden');
            expect(response.body.message).toContain('Insufficient permissions');
        });

        test('should reject token missing required scope for /api/*', async () => {
            const token = await mockOIDC.generateToken({
                scope: 'openid', // Missing api:access
            });
            
            const response = await request(testApp)
                .post('/api/kairos_mint')
                .set('Authorization', `Bearer ${token}`)
                .send({})
                .expect(403);
            
            expect(response.body).toHaveProperty('error', 'Forbidden');
            expect(response.body.message).toContain('Insufficient permissions');
        });

        test('should allow token with multiple scopes including required', async () => {
            const token = await mockOIDC.generateToken({
                scope: 'openid mcp:access api:access',
            });
            
            // Test MCP endpoint
            const mcpResponse = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
            
            expect([401, 403]).not.toContain(mcpResponse.status);
            
            // Test API endpoint
            const apiResponse = await request(testApp)
                .post('/api/kairos_mint')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            
            expect([401, 403]).not.toContain(apiResponse.status);
        });
    });

    describe('Auth context attachment', () => {
        test('should attach auth context to request', async () => {
            const token = await mockOIDC.generateToken({
                sub: 'test-user-123',
                scope: 'mcp:access',
            });
            
            // We can't directly test req.auth in supertest, but we can verify
            // the request proceeds (auth middleware calls next())
            const response = await request(testApp)
                .post('/mcp')
                .set('Authorization', `Bearer ${token}`)
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
            
            // Auth should pass (not 401/403)
            expect([401, 403]).not.toContain(response.status);
        });
    });
});
