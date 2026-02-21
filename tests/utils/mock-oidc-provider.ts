/**
 * Mock OIDC provider for testing - lightweight JWKS server
 */

import express from 'express';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { createServer } from 'http';
import { AddressInfo } from 'net';

export class MockOIDCProvider {
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
