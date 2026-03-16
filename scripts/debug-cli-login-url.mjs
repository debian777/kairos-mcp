#!/usr/bin/env node
/**
 * Debug: print the auth URL the CLI would use and probe Keycloak.
 * Two log sources: app logs = well-known / callback; Keycloak logs = auth and login.
 * If Keycloak logs show no login attempts, the browser may be hitting a URL
 * it cannot reach (e.g. http://keycloak:8080/... from the host).
 *
 * Usage: node scripts/debug-cli-login-url.mjs [KAIROS_API_URL]
 * Example: KAIROS_API_URL=http://localhost:3300 node scripts/debug-cli-login-url.mjs
 */
const baseUrl = (process.env.KAIROS_API_URL || 'http://localhost:3300').replace(/\/$/, '');
const wellKnownUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

async function main() {
  console.log('Fetching well-known from:', wellKnownUrl);
  let meta;
  try {
    const res = await fetch(wellKnownUrl);
    if (!res.ok) {
      console.error('Well-known failed:', res.status, await res.text());
      process.exit(1);
    }
    meta = await res.json();
  } catch (e) {
    console.error('Fetch failed:', e.message);
    process.exit(1);
  }

  const authEndpoint = meta.authorization_endpoint || (meta.authorization_servers?.[0] ? `${meta.authorization_servers[0].replace(/\/$/, '')}/protocol/openid-connect/auth` : '');
  if (!authEndpoint) {
    console.error('No authorization_endpoint or authorization_servers in well-known');
    process.exit(1);
  }

  console.log('Auth URL (what the CLI prints / browser opens):', authEndpoint);
  console.log('Probing Keycloak (GET auth URL)...');
  try {
    const authRes = await fetch(authEndpoint, { redirect: 'manual' });
    console.log('Keycloak response:', authRes.status, authRes.statusText);
    if (authRes.headers.get('location')) {
      console.log('Redirect:', authRes.headers.get('location'));
    }
    if (authRes.status === 200) {
      console.log('Keycloak is reachable from this process. If the browser still does not show login, the URL may not be reachable from the browser (e.g. keycloak:8080 from host).');
    } else if (authRes.status >= 300 && authRes.status < 400) {
      console.log('Keycloak redirected (expected for auth). Reachable from this process.');
    } else {
      console.log('Unexpected status. Keycloak may be down or the URL wrong.');
    }
  } catch (e) {
    console.error('Probe failed:', e.message);
    console.error('Keycloak is NOT reachable from this process at', authEndpoint);
    console.error('For CLI browser login, KEYCLOAK_URL in the server .env must be a URL the browser can open (e.g. http://localhost:8080). If the server runs in Docker with KEYCLOAK_URL=http://keycloak:8080, the browser on the host cannot resolve "keycloak". Set KEYCLOAK_URL=http://localhost:8080 and KEYCLOAK_INTERNAL_URL=http://keycloak:8080 so well-known returns a host-reachable URL.');
    process.exit(1);
  }
}

main();
