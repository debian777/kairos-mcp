/**
 * Helpers for CLI auth E2E (browser login). Used by cli-auth-browser-login.e2e.test.ts.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const REPORTS_DIR = join(process.cwd(), 'reports');

/** Verify kairos-cli client exists in Keycloak kairos-dev realm (after configure-keycloak-realms.py). */
export async function keycloakHasKairosCliClient(
  keycloakUrl: string,
  adminPassword: string
): Promise<boolean> {
  const base = keycloakUrl.replace(/\/$/, '');
  const tokenRes = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: adminPassword
    })
  });
  if (!tokenRes.ok) return false;
  const tokenBody = (await tokenRes.json()) as { access_token?: string };
  const token = tokenBody.access_token;
  if (!token) return false;
  const clientsRes = await fetch(`${base}/admin/realms/kairos-dev/clients`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!clientsRes.ok) return false;
  const clients = (await clientsRes.json()) as Array<{ clientId?: string }>;
  return clients.some((c) => c.clientId === 'kairos-cli');
}

/** On E2E failure, save screenshot and HTML to reports/ for debugging Keycloak page. */
export async function saveE2EDiagnostics(
  page: {
    url: () => string;
    content: () => Promise<string>;
    screenshot: (opts?: { path?: string }) => Promise<Buffer>;
  },
  authUrl: string,
  err: unknown
): Promise<void> {
  try {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const ts = Date.now();
    const prefix = join(REPORTS_DIR, `e2e-cli-auth-failure-${ts}`);
    const currentUrl = page.url();
    await page.screenshot({ path: `${prefix}.png` });
    const html = await page.content();
    writeFileSync(`${prefix}.html`, html, 'utf-8');
    writeFileSync(
      `${prefix}.txt`,
      `authUrl: ${authUrl}\ncurrentUrl: ${currentUrl}\nerror: ${err instanceof Error ? err.message : String(err)}\n`,
      'utf-8'
    );
  } catch {
    // ignore write errors
  }
}
