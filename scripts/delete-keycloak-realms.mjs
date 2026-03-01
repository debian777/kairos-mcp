#!/usr/bin/env node
/**
 * Delete KAIROS Keycloak realms (kairos-dev, kairos-qa, kairos-prod) via Admin API.
 * Requires KEYCLOAK_ADMIN_PASSWORD in .env; Keycloak at KEYCLOAK_URL (default http://localhost:8080).
 * Usage: node scripts/delete-keycloak-realms.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const REALMS_TO_DELETE = ['kairos-dev', 'kairos-qa', 'kairos-prod'];

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

function getAdminPassword() {
  if (process.env.KEYCLOAK_ADMIN_PASSWORD) return process.env.KEYCLOAK_ADMIN_PASSWORD;
  const env = loadEnvFile(join(root, '.env'));
  return env.KEYCLOAK_ADMIN_PASSWORD || null;
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
    console.error(`Failed to get admin token: ${res.status} ${text}`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  if (!data.access_token) {
    console.error('No access_token in token response');
    process.exit(1);
  }
  return data.access_token;
}

async function deleteRealm(baseUrl, realm, token) {
  const url = `${baseUrl.replace(/\/$/, '')}/admin/realms/${realm}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    const text = await res.text();
    console.error(`Delete realm ${realm} failed: ${res.status} ${text}`);
    process.exit(1);
  }
  return true;
}

async function main() {
  const baseUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    console.error('KEYCLOAK_ADMIN_PASSWORD not set (set in .env)');
    process.exit(1);
  }

  const token = await getAdminToken(baseUrl, adminPassword);
  for (const realm of REALMS_TO_DELETE) {
    if (await deleteRealm(baseUrl, realm, token)) {
      console.log(`Deleted realm ${realm}.`);
    } else {
      console.log(`Realm ${realm} not found (404), skip.`);
    }
  }
  console.log('To re-create realms run: node scripts/configure-keycloak-realms.mjs');
}

main();
