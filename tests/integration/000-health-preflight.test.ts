import { getTestAuthBaseUrl, isHttpTransport } from '../utils/auth-headers.js';

const _d = isHttpTransport() ? describe : describe.skip;

_d('integration preflight: /health', () => {
  test(
    'server is healthy',
    async () => {
      const baseUrl = getTestAuthBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2000)
      });
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { status?: string };
      expect(body.status).toBe('healthy');
    },
    5000
  );
});
