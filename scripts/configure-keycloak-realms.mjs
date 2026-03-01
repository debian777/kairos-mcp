#!/usr/bin/env node
/* eslint-disable max-lines -- standalone Keycloak config script */
/**
 * Idempotent Keycloak realm setup: import from scripts/keycloak/import, set trusted hosts, create test user (dev/qa).
 * Runs via Admin API. Env: KEYCLOAK_URL, KEYCLOAK_ADMIN_PASSWORD, TEST_USERNAME, TEST_PASSWORD (from .env).
 * Usage: node scripts/configure-keycloak-realms.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const importDir = join(root, 'scripts', 'keycloak', 'import');

const CLIENT_REGISTRATION_POLICY_TYPE = 'org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy';
const TRUSTED_HOSTS_PROVIDER_ID = 'trusted-hosts';
const NETWORK_NAME = 'kairos-network';
const REALM_FILES = [
  ['kairos-dev', 'kairos-dev-realm.json'],
  ['kairos-qa', 'kairos-qa-realm.json'],
  ['kairos-prod', 'kairos-prod-realm.json'],
];

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const idx = s.indexOf('=');
    if (idx > 0) {
      const k = s.slice(0, idx).trim();
      const v = s.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      out[k] = v;
    }
  }
  return out;
}

function getEnv() {
  const env = { ...loadEnvFile(join(root, '.env')) };
  for (const [k, v] of Object.entries(process.env)) {
    if (v != null) env[k] = v;
  }
  return env;
}

async function getAdminToken(baseUrl, adminPassword) {
  const url = `${baseUrl.replace(/\/$/, '')}/realms/master/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: 'admin',
    password: adminPassword,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Admin token failed: ${res.status} ${text}`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  if (!data.access_token) {
    console.error('No access_token in token response');
    process.exit(1);
  }
  return data.access_token;
}

async function api(baseUrl, token, { method = 'GET', path, body } = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`;
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    console.error(`${method} ${path} failed: ${res.status} ${text}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

async function listRealms(baseUrl, token) {
  const realms = await api(baseUrl, token, { path: '/admin/realms' });
  return (realms || []).map((r) => r.realm);
}

async function createRealmMinimal(baseUrl, token, realmName) {
  const url = `${baseUrl.replace(/\/$/, '')}/admin/realms`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ realm: realmName, enabled: true }),
  });
  if (res.status === 409) return false;
  const text = await res.text();
  if (!res.ok) {
    console.error(`Create realm ${realmName} failed: ${res.status} ${text}`);
    process.exit(1);
  }
  return true;
}

async function getRealmFull(baseUrl, realmName, token) {
  return api(baseUrl, token, { path: `/admin/realms/${realmName}` });
}

async function updateRealm(baseUrl, realmName, realmJson, token) {
  await api(baseUrl, token, {
    method: 'PUT',
    path: `/admin/realms/${realmName}`,
    body: realmJson,
  });
}

function mergeRealm(current, desired) {
  const merged = { ...current };
  merged.id = current.id || desired.id || current.realm;
  const topKeys = [
    'realm', 'enabled', 'registrationAllowed', 'loginWithEmailAllowed', 'duplicateEmailsAllowed',
    'ssoSessionIdleTimeout', 'ssoSessionMaxLifespan', 'accessCodeLifespan',
    'accessCodeLifespanUserAction', 'accessCodeLifespanLogin', 'groups',
  ];
  for (const key of topKeys) {
    if (desired[key] !== undefined) merged[key] = desired[key];
  }

  const desiredClientIds = new Set(
    (desired.clients || []).filter((c) => c.clientId).map((c) => c.clientId)
  );
  const currentClients = [...(current.clients || [])];
  const mergedClients = currentClients.filter((c) => !desiredClientIds.has(c.clientId));
  for (const d of desired.clients || []) {
    const cid = d.clientId;
    if (!cid) continue;
    const existing = currentClients.find((c) => c.clientId === cid);
    const newClient = { ...d };
    if (existing && existing.id != null) newClient.id = existing.id;
    mergedClients.push(newClient);
  }
  merged.clients = mergedClients;

  const desiredFlowAliases = new Set(
    (desired.authenticationFlows || []).filter((f) => f.alias).map((f) => f.alias)
  );
  const currentFlows = [...(current.authenticationFlows || [])];
  const mergedFlows = currentFlows.filter((f) => !desiredFlowAliases.has(f.alias));
  for (const d of desired.authenticationFlows || []) {
    const alias = d.alias;
    if (!alias) continue;
    const existing = currentFlows.find((f) => f.alias === alias);
    const newFlow = { ...d };
    if (existing && existing.id != null) newFlow.id = existing.id;
    mergedFlows.push(newFlow);
  }
  merged.authenticationFlows = mergedFlows;

  return merged;
}

function runDocker(...args) {
  try {
    const out = execSync('docker', args, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return (out || '').trim() || null;
  } catch {
    return null;
  }
}

function dockerNetworkGateway() {
  const out = runDocker(
    'network', 'inspect', NETWORK_NAME,
    '--format', '{{(index .IPAM.Config 0).Gateway}}'
  );
  if (!out || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(out)) return null;
  return out;
}

function dockerContainerIpOnNetwork(serviceName) {
  const out = runDocker('network', 'inspect', NETWORK_NAME, '--format', '{{json .Containers}}');
  if (!out) return null;
  let containers;
  try {
    containers = JSON.parse(out);
  } catch {
    return null;
  }
  for (const info of Object.values(containers || {})) {
    const name = info.Name || '';
    if (name.includes(serviceName)) {
      const addr = (info.IPv4Address || '').split('/')[0];
      if (addr && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) return addr;
    }
  }
  return null;
}

function getTrustedHostsForEnv(env) {
  const base = ['127.0.0.1', 'localhost'];
  const gateway = dockerNetworkGateway();
  if (gateway) base.push(gateway);
  if (env === 'dev') {
    if (!gateway) {
      console.warn('WARNING: Docker network gateway not found; only 127.0.0.1 trusted for dev.');
    }
  } else if (env === 'qa') {
    const ip = dockerContainerIpOnNetwork('app-qa');
    if (ip) base.push(ip);
    base.push('app-qa');
  } else if (env === 'prod') {
    const ip = dockerContainerIpOnNetwork('app-prod');
    if (ip) base.push(ip);
    base.push('app-prod');
  }
  return base;
}

async function getRealmId(baseUrl, realm, token) {
  const data = await api(baseUrl, token, { path: `/admin/realms/${realm}` });
  return data.id || realm;
}

async function getComponents(baseUrl, realm, token, parentId, type) {
  const q = new URLSearchParams({ parent: parentId, type });
  return api(baseUrl, token, { path: `/admin/realms/${realm}/components?${q}` }) || [];
}

async function updateComponent(baseUrl, realm, componentId, payload, token) {
  await api(baseUrl, token, {
    method: 'PUT',
    path: `/admin/realms/${realm}/components/${componentId}`,
    body: payload,
  });
}

async function ensureTrustedHosts(baseUrl, realm, env, token) {
  const parentId = await getRealmId(baseUrl, realm, token);
  const components = await getComponents(
    baseUrl, realm, token, parentId, CLIENT_REGISTRATION_POLICY_TYPE
  );
  const trusted = components.find((c) => c.providerId === TRUSTED_HOSTS_PROVIDER_ID);
  if (!trusted?.id) {
    console.warn(`WARNING: No Trusted Hosts component in ${realm}; skip.`);
    return;
  }
  const trustedHosts = getTrustedHostsForEnv(env);
  const config = { ...(trusted.config || {}) };
  config['host-sending-registration-request-must-match'] = ['true'];
  config['trusted-hosts'] = trustedHosts;
  config['client-uris-must-match'] = ['false'];
  await updateComponent(baseUrl, realm, trusted.id, { ...trusted, config }, token);
  console.log(`  Trusted hosts ${realm}:`, trustedHosts);
}

async function getUserId(baseUrl, realm, username, token) {
  const q = new URLSearchParams({ username });
  const users = await api(baseUrl, token, { path: `/admin/realms/${realm}/users?${q}` });
  return (users && users[0] && users[0].id) || null;
}

async function createUser(baseUrl, realm, username, token) {
  const url = `${baseUrl.replace(/\/$/, '')}/admin/realms/${realm}/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, enabled: true }),
  });
  if (res.status === 409) return null;
  const text = await res.text();
  if (!res.ok) {
    console.error(`Create user failed: ${res.status} ${text}`);
    process.exit(1);
  }
  const location = res.headers.get('Location');
  return location ? location.replace(/\/$/, '').split('/').pop() : null;
}

async function setPassword(baseUrl, realm, userId, password, token) {
  await api(baseUrl, token, {
    method: 'PUT',
    path: `/admin/realms/${realm}/users/${userId}/reset-password`,
    body: { type: 'password', value: password, temporary: false },
  });
}

async function ensureTestUser(baseUrl, realm, username, password, token) {
  let userId = await getUserId(baseUrl, realm, username, token);
  if (!userId) userId = await createUser(baseUrl, realm, username, token);
  if (!userId) {
    console.warn(`WARNING: Could not create/find user ${username} in ${realm}.`);
    return;
  }
  await setPassword(baseUrl, realm, userId, password, token);
  console.log(`  Test user ${realm}: ${username}`);
}

async function main() {
  const env = getEnv();
  const baseUrl = env.KEYCLOAK_URL || 'http://localhost:8080';
  const adminPassword = env.KEYCLOAK_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('KEYCLOAK_ADMIN_PASSWORD not set. Set in .env or export.');
    process.exit(1);
  }

  const testUsername = env.TEST_USERNAME || 'kairos-tester';
  const testPassword = env.TEST_PASSWORD || 'kairos-tester-secret';

  const token = await getAdminToken(baseUrl, adminPassword);
  const existing = await listRealms(baseUrl, token);

  for (const [realmName, filename] of REALM_FILES) {
    const path = join(importDir, filename);
    if (!existsSync(path)) {
      console.warn(`Realm file not found: ${path}, skip.`);
      continue;
    }
    if (!existing.includes(realmName)) {
      await createRealmMinimal(baseUrl, token, realmName);
      console.log(`Created realm ${realmName} (defaults).`);
    }
    const current = await getRealmFull(baseUrl, realmName, token);
    const desired = JSON.parse(readFileSync(path, 'utf8'));
    const merged = mergeRealm(current, desired);
    await updateRealm(baseUrl, realmName, merged, token);
    console.log(`Updated realm ${realmName}.`);
  }

  for (const [realmName] of REALM_FILES) {
    const envKey = realmName.replace('kairos-', '');
    await ensureTrustedHosts(baseUrl, realmName, envKey, token);
  }

  for (const realmName of ['kairos-dev', 'kairos-qa']) {
    await ensureTestUser(baseUrl, realmName, testUsername, testPassword, token);
  }

  console.log('Keycloak realms configured.');
}

main();
