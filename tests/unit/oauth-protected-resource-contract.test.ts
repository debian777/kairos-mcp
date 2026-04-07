import { beforeAll, describe, expect, it } from '@jest/globals';

let buildProtectedResourceMetadata: () => Record<string, unknown>;
let buildAuthorizationServerMetadata: (upstream: Record<string, unknown>) => Record<string, unknown>;

beforeAll(async () => {
    process.env['AUTH_CALLBACK_BASE_URL'] = 'http://localhost:3300';
    process.env['KEYCLOAK_URL'] = 'http://keycloak.local:8180';
    process.env['KEYCLOAK_REALM'] = 'kairos-dev';
    process.env['KEYCLOAK_CLI_CLIENT_ID'] = 'kairos-cli';

    const mod = await import('../../src/http/http-well-known.js');
    buildProtectedResourceMetadata = mod.buildProtectedResourceMetadata;
    buildAuthorizationServerMetadata = mod.buildAuthorizationServerMetadata;
});

// ---------------------------------------------------------------------------
// Bug: authorization_servers points to KAIROS app instead of Keycloak issuer.
// MCP clients fetch /.well-known/oauth-authorization-server from that server,
// which strips registration_endpoint → "does not support dynamic client registration".
// ---------------------------------------------------------------------------

describe('Protected Resource Metadata (buildProtectedResourceMetadata)', () => {
    it('authorization_servers must point to Keycloak issuer, not KAIROS app base', () => {
        const meta = buildProtectedResourceMetadata();
        const servers = meta['authorization_servers'] as string[];

        expect(servers).toHaveLength(1);
        // Must be the Keycloak realm issuer — NOT the KAIROS app base URL.
        expect(servers[0]).toBe('http://keycloak.local:8180/realms/kairos-dev');
        expect(servers[0]).not.toBe('http://localhost:3300');
    });

    it('token_endpoint issuer must match authorization_servers[0]', () => {
        const meta = buildProtectedResourceMetadata();
        const servers = meta['authorization_servers'] as string[];
        const tokenEndpoint = meta['token_endpoint'] as string;

        const issuerFromToken = tokenEndpoint.replace(/\/protocol\/openid-connect\/token$/, '');
        expect(servers[0]).toBe(issuerFromToken);
    });
});

// ---------------------------------------------------------------------------
// Bug: buildAuthorizationServerMetadata strips registration_endpoint from
// Keycloak metadata. MCP hosts (e.g. Cursor streamable HTTP) require it for
// Dynamic Client Registration. Stripping causes the connection failure.
// ---------------------------------------------------------------------------

describe('Authorization Server Metadata (buildAuthorizationServerMetadata)', () => {
    const UPSTREAM_KEYCLOAK = {
        issuer: 'http://keycloak.local:8180/realms/kairos-dev',
        authorization_endpoint: 'http://keycloak.local:8180/realms/kairos-dev/protocol/openid-connect/auth',
        token_endpoint: 'http://keycloak.local:8180/realms/kairos-dev/protocol/openid-connect/token',
        registration_endpoint: 'http://keycloak.local:8180/realms/kairos-dev/clients-registrations/openid-connect',
        mtls_endpoint_aliases: {
            registration_endpoint: 'http://keycloak.local:8180/realms/kairos-dev/clients-registrations/openid-connect',
        },
    };

    it('must preserve registration_endpoint from upstream Keycloak metadata', () => {
        const result = buildAuthorizationServerMetadata({ ...UPSTREAM_KEYCLOAK });
        expect(result['registration_endpoint']).toBe(UPSTREAM_KEYCLOAK.registration_endpoint);
    });

    it('must preserve registration_endpoint in mtls_endpoint_aliases', () => {
        const result = buildAuthorizationServerMetadata({ ...UPSTREAM_KEYCLOAK });
        const aliases = result['mtls_endpoint_aliases'] as Record<string, unknown>;
        expect(aliases['registration_endpoint']).toBe(
            UPSTREAM_KEYCLOAK.mtls_endpoint_aliases.registration_endpoint
        );
    });

    it('must set client_id_metadata_document_supported', () => {
        const result = buildAuthorizationServerMetadata({ ...UPSTREAM_KEYCLOAK });
        expect(result['client_id_metadata_document_supported']).toBe(true);
    });

    it('must pass through all other upstream fields unchanged', () => {
        const result = buildAuthorizationServerMetadata({ ...UPSTREAM_KEYCLOAK });
        expect(result['issuer']).toBe(UPSTREAM_KEYCLOAK.issuer);
        expect(result['authorization_endpoint']).toBe(UPSTREAM_KEYCLOAK.authorization_endpoint);
        expect(result['token_endpoint']).toBe(UPSTREAM_KEYCLOAK.token_endpoint);
    });
});
