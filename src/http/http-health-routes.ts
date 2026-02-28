import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { embeddingService } from '../services/embedding/service.js';
import { redisService } from '../services/redis.js';
import { getBuildVersion } from '../utils/build-version.js';
import { AUTH_ENABLED } from '../config.js';

/**
 * Set up health check and basic info routes
 * @param app Express application instance
 * @param memoryStore Memory store instance for health checks
 */
export function setupHealthRoutes(app: express.Express, memoryStore: MemoryQdrantStore) {
    // Health check endpoint (non-MCP)
    app.get('/health', async (req, res) => {
        // Qdrant is the critical dependency for store functionality tests.
        const qdrantHealthy = await memoryStore.checkHealth().catch(() => false);
        // Redis and embedding providers are non-critical for allowing tests to proceed,
        // but reported for diagnostics.
        const redisHealthy = redisService.isConnected();
        let teiHealth = { healthy: false, message: 'Embedding provider not configured' as string };

        // Run embedding health check but bound it with a short timeout so /health is responsive
        try {
            const teiCheck = (async () => {
                if (typeof (embeddingService as any).teiHealthCheck === 'function') {
                    return await (embeddingService as any).teiHealthCheck().catch(() => ({ healthy: false, message: 'TEI check failed' }));
                } else {
                    return await embeddingService.healthCheck().catch(() => ({ healthy: false, message: 'Embedding health check failed' }));
                }
            })();

            // Timeout after 2000ms to avoid blocking during test setup
            let timeoutId: NodeJS.Timeout | undefined;
            const timeout = new Promise(resolve => {
                timeoutId = setTimeout(() => resolve({ healthy: false, message: 'Embedding health check timed out' }), 2000);
            });
            teiHealth = (await Promise.race([teiCheck, timeout])) as { healthy: boolean; message: string };
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        } catch {
            teiHealth = { healthy: false, message: 'Embedding health check failed' };
        }

        const teiHealthy = !!teiHealth.healthy;
        const embeddingCfg = embeddingService.getConfig ? embeddingService.getConfig() : ({ provider: 'unknown' } as any);

        // Only treat Qdrant as a blocking failure so tests that exercise store functionality can proceed.
        const criticalHealthy = qdrantHealthy;
        const nonCriticalAllHealthy = redisHealthy && teiHealthy;
        const healthStatus = criticalHealthy ? (nonCriticalAllHealthy ? 'healthy' : 'degraded') : 'unhealthy';
        const statusCode = criticalHealthy ? 200 : 503;

        const buildVersion = getBuildVersion();
        const uptime = Math.floor(process.uptime());

        res.status(statusCode).json({
            status: healthStatus,
            service: 'KAIROS',
            version: buildVersion,
            transport: 'http',
            uptime: uptime,
            dependencies: {
                qdrant: qdrantHealthy ? 'healthy' : 'unhealthy',
                redis: redisHealthy ? 'healthy' : 'unhealthy',
                embedding: teiHealthy ? 'healthy' : 'unhealthy'
            },
            details: {
                embedding: teiHealth.message,
                provider: embeddingCfg.provider || 'auto',
                providerPref: (embeddingCfg as any).providerPref || 'auto'
            }
        });
    });

    // Root (UI): when AUTH_ENABLED, only reached when authenticated; unauthenticated GET redirects to login.
    app.get('/', (req, res) => {
        const body: Record<string, unknown> = {
            service: 'KAIROS MCP Server',
            version: getBuildVersion(),
            transports: ['http'],
            endpoints: {
                health: '/health',
                mcp: '/mcp',
                api: '/api'
            },
            note: 'Use POST /mcp for MCP protocol communication'
        };
        if (AUTH_ENABLED) {
            body['api_note'] = 'GET / and GET /api, POST /api/* require authentication (session or Bearer). Use login_url from 401 or /auth/callback flow.';
        }
        res.json(body);
    });

    // API root (when AUTH_ENABLED, only reached when authenticated)
    app.get('/api', (req, res) => {
        const body: Record<string, unknown> = {
            service: 'KAIROS API',
            version: getBuildVersion(),
            endpoints: {
                kairos_search: 'POST /api/kairos_search',
                kairos_begin: 'POST /api/kairos_begin',
                kairos_next: 'POST /api/kairos_next',
                kairos_attest: 'POST /api/kairos_attest',
                kairos_mint: 'POST /api/kairos_mint/raw',
                kairos_update: 'POST /api/kairos_update',
                kairos_delete: 'POST /api/kairos_delete',
                kairos_dump: 'POST /api/kairos_dump'
            }
        };
        if (AUTH_ENABLED) {
            body['auth_required'] = true;
            body['note'] = 'These endpoints require a valid session or Bearer token. Unauthenticated requests receive 401 with login_url.';
        }
        res.json(body);
    });
}