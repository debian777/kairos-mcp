import { describe, expect, test } from '@jest/globals';
import { integrationReportSection, snapshotForIntegrationReport } from '../../scripts/ai-mcp-integration-report-utils.mjs';

describe('ai-mcp integration report utils', () => {
  test('redacts obvious sensitive strings and strips URL query strings', () => {
    const section = integrationReportSection(
      'Train',
      {
        endpoint: '/api/train/raw',
        token: 'secret-token-value',
        auth: 'Bearer abc.def.ghi',
        login_url: 'http://localhost:8080/realms/dev/auth?client_id=foo&code=secret'
      },
      {
        result_kind: 'auth_required',
        login_url: 'http://localhost:8080/realms/dev/auth?client_id=foo&code=secret',
        nested: {
          authorization: 'Bearer super-secret-value',
          jwt: 'eyJhbGciOiJIUzI1NiJ9.abc.signature'
        }
      }
    );

    expect(section).toContain('[redacted]');
    expect(section).toContain('http://localhost:8080/realms/dev/auth?[redacted]');
    expect(section).not.toContain('secret-token-value');
    expect(section).not.toContain('super-secret-value');
    expect(section).not.toContain('eyJhbGciOiJIUzI1NiJ9.abc.signature');
    expect(section).not.toContain('code=secret');
  });

  test('bounds nested proof objects without mutating primitive facts', () => {
    const safe = snapshotForIntegrationReport({
      ok: true,
      items_count: 3,
      nested: {
        depth1: {
          depth2: {
            depth3: {
              depth4: {
                depth5: {
                  depth6: {
                    depth7: {
                      depth8: {
                        depth9: 'too-deep'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    expect(safe).toMatchObject({ ok: true, items_count: 3 });
    expect(JSON.stringify(safe)).toContain('[max depth]');
  });
});
