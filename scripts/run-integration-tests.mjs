#!/usr/bin/env node
/**
 * Start full infra, configure Keycloak, start app, run integration tests, then shut down infra.
 * Usage: npm run test:integration  (or node scripts/run-integration-tests.mjs)
 * Requires: .env, dist/ built. Uses same project name and profile as infra:up/infra:down.
 */
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const COMPOSE = 'docker compose -p kairos-mcp --env-file .env --profile infra';

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

function exec(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, maxAttempts = 60, intervalMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(url);
      if (r && r.ok) return true;
    } catch (_) {}
    await sleep(intervalMs);
  }
  return false;
}

async function waitForRedis() {
  for (let i = 0; i < 30; i++) {
    try {
      const out = execSync(
        'docker compose -p kairos-mcp --env-file .env --profile infra exec -T redis redis-cli ping',
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
      if (out && out.trim() === 'PONG') return true;
    } catch (_) {}
    await sleep(2000);
  }
  return false;
}

async function waitForPostgres() {
  for (let i = 0; i < 30; i++) {
    try {
      execSync(
        'docker compose -p kairos-mcp --env-file .env --profile infra exec -T postgres pg_isready -U keycloak -d keycloak 2>/dev/null',
        { cwd: root, encoding: 'utf8' }
      );
      return true;
    } catch (_) {}
    await sleep(2000);
  }
  return false;
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const port = env.PORT || '3300';
  const appHealth = `http://127.0.0.1:${port}/healthz`;

  if (!existsSync(join(root, '.env'))) {
    console.error('Missing .env. Run node scripts/generate_dev_secrets.mjs first.');
    process.exit(1);
  }
  if (!existsSync(join(root, 'dist', 'index.js'))) {
    console.error('Missing dist/index.js. Run npm run build first.');
    process.exit(1);
  }

  console.log('Starting Docker infra...');
  exec(`${COMPOSE} up -d --remove-orphans`);

  console.log('Waiting for Redis...');
  if (!(await waitForRedis())) {
    console.error('Redis did not become ready.');
    exec(`${COMPOSE} down`);
    process.exit(1);
  }
  console.log('Waiting for Qdrant...');
  const qdrantUrl = (env.QDRANT_URL || 'http://localhost:6333').replace(/\/$/, '');
  if (!(await waitForHttp(`${qdrantUrl}/healthz`, 30))) {
    console.error('Qdrant did not become ready.');
    exec(`${COMPOSE} down`);
    process.exit(1);
  }
  console.log('Waiting for Postgres...');
  if (!(await waitForPostgres())) {
    console.error('Postgres did not become ready.');
    exec(`${COMPOSE} down`);
    process.exit(1);
  }
  console.log('Waiting for Keycloak...');
  if (!(await waitForHttp('http://localhost:9000/health/ready', 90))) {
    console.error('Keycloak did not become ready.');
    exec(`${COMPOSE} down`);
    process.exit(1);
  }

  console.log('Configuring Keycloak realms...');
  exec('node scripts/configure-keycloak-realms.mjs');

  console.log('Starting app in background...');
  const app = spawn('npx', ['dotenv', '-e', '.env', '--', 'node', 'dist/index.js'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...env },
  });
  app.unref();

  console.log('Waiting for app health...');
  if (!(await waitForHttp(appHealth, 15))) {
    console.error('App did not become ready.');
    try {
      execSync(`node scripts/stop-by-port.mjs`, { cwd: root, stdio: 'inherit' });
    } catch (_) {}
    exec(`${COMPOSE} down`);
    process.exit(1);
  }

  let jestCode = 1;
  try {
    console.log('Running integration tests...');
    execSync(
      'npx dotenv -e .env -- NODE_OPTIONS=\'--experimental-vm-modules\' jest --runInBand --detectOpenHandles --testTimeout=30000',
      { cwd: root, stdio: 'inherit' }
    );
    jestCode = 0;
  } catch (e) {
    jestCode = e.status ?? 1;
  } finally {
    console.log('Stopping app...');
    try {
      exec('node scripts/stop-by-port.mjs');
    } catch (_) {}
    console.log('Shutting down infra...');
    exec(`${COMPOSE} down`);
  }

  process.exit(jestCode);
}

main();
