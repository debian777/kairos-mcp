#!/usr/bin/env node
/**
 * Ensure Qdrant is running (start with profile "app" if needed), then wait for health.
 * Used by npm start / npm run dev so the app always has Qdrant.
 * Usage: node scripts/ensure-qdrant-up.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const p = join(root, '.env');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i > 0) out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function getQdrantHealthUrl() {
  const env = { ...loadEnv(), ...process.env };
  const base = (env.QDRANT_URL || 'http://localhost:6333').replace(/\/$/, '');
  return `${base}/healthz`;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(url, maxAttempts = 30, intervalMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res && res.ok) return true;
    } catch (_) {}
    if (i < maxAttempts) {
      if (process.stdout.isTTY) process.stdout.write(`  Waiting for Qdrant (${i}/${maxAttempts})...\r`);
      await sleep(intervalMs);
    }
  }
  return false;
}

async function main() {
  const envFile = join(root, '.env');
  if (!existsSync(envFile)) {
    console.warn('No .env; run node scripts/generate_dev_secrets.mjs first. Skipping Qdrant check.');
    process.exit(0);
  }
  execSync('docker compose -p kairos-mcp --env-file .env --profile app up -d', {
    cwd: root,
    stdio: 'inherit',
  });
  const url = getQdrantHealthUrl();
  if (process.stdout.isTTY) console.log('Waiting for Qdrant at', url);
  const ok = await waitFor(url);
  if (!ok) {
    console.error('Qdrant did not become ready at', url);
    process.exit(1);
  }
  if (process.stdout.isTTY) console.log('Qdrant is ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
