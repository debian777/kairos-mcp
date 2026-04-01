import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';

const payloadByToken = new Map<string, Record<string, unknown>>();

function tokenFor(payload: Record<string, unknown>): string {
  const key = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const token = `token-${key}`;
  payloadByToken.set(token, payload);
  return token;
}

jest.unstable_mockModule('jose/jwt/decode', () => ({
  decodeJwt: (token: string) => payloadByToken.get(token) ?? {}
}));

jest.unstable_mockModule('jose', () => ({
  createRemoteJWKSet: () => async () => ({}) as never,
  jwtVerify: async (token: string) => ({ payload: payloadByToken.get(token) ?? {} })
}));

jest.unstable_mockModule('../../src/http/oidc-profile-claims.js', () => ({
  applyOidcGroupsAllowlist: (groups: string[]) => groups,
  enrichAuthPayloadFromVerifiedJwt: () => ({ account_kind: 'local', account_label: 'Local' }),
  extractGroupsFromPayload: (payload: Record<string, unknown>) =>
    Array.isArray(payload.groups) ? payload.groups.filter((x): x is string => typeof x === 'string') : [],
  realmFromIssuer: (iss: string) => {
    const match = /\/realms\/([^/]+)/.exec(iss);
    return match?.[1] ?? 'default';
  }
}));

describe('validateBearerToken group extraction', () => {
  let validateBearerToken: typeof import('../../src/http/bearer-validate.js').validateBearerToken;

  beforeAll(async () => {
    ({ validateBearerToken } = await import('../../src/http/bearer-validate.js'));
  });

  afterEach(() => {
    payloadByToken.clear();
  });

  test('uses id_token groups when access token has no groups', async () => {
    const issuer = 'https://kc.example/realms/kairos-dev';
    const token = tokenFor({
      iss: issuer,
      sub: 'user-1',
      aud: ['kairos-mcp'],
      id_token: tokenFor({
        groups: ['/SHARED/PE-TEAM']
      })
    });

    const auth = await validateBearerToken(token, [issuer], ['kairos-mcp']);
    expect(auth).not.toBeNull();
    expect(auth?.groups).toEqual(['/SHARED/PE-TEAM']);
  });
});
