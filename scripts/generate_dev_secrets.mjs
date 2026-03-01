#!/usr/bin/env node
/**
 * Generate .env from template. Template uses __VAR_NAME__ placeholders
 * replaced by env var or generated secret.
 * Source of truth: scripts/env/.env.template
 * Outputs: .env (all enabled). Plain "npm test" overrides AUTH_ENABLED=false REDIS_URL=.
 * Usage: node scripts/generate_dev_secrets.mjs [--write-templates] [--verify] [--force]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PROD_PORT_DEFAULTS = { PORT: 3000, METRICS_PORT: 9090, QDRANT_HTTP: 6333, REDIS: 6379, KEYCLOAK: 8080 };
const DEV_OFFSET = 300;
const SECRET_KEYS = ['KEYCLOAK_ADMIN_PASSWORD', 'KEYCLOAK_DB_PASSWORD', 'QDRANT_API_KEY', 'SESSION_SECRET', 'OPENAI_API_KEY'];
const PLACEHOLDER_RE = /^__([A-Za-z_][A-Za-z0-9_]*)__$/;

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function readEnvLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n');
}

function resolveSecrets(keys, existing, force) {
  const resolved = {};
  for (const key of keys) {
    let val = process.env[key] || existing[key];
    if (val && !force) {
      resolved[key] = val;
      continue;
    }
    if (['KEYCLOAK_ADMIN_PASSWORD', 'KEYCLOAK_DB_PASSWORD', 'QDRANT_API_KEY'].includes(key)) {
      resolved[key] = randomBytes(24).toString('base64url');
    } else if (key === 'SESSION_SECRET') {
      resolved[key] = process.env[key] || randomBytes(32).toString('hex');
    } else if (key === 'OPENAI_API_KEY') {
      resolved[key] = process.env[key] || '';
    } else {
      resolved[key] = process.env[key] || '';
    }
  }
  return resolved;
}

function applyDevPorts(data) {
  const port = PROD_PORT_DEFAULTS.PORT + DEV_OFFSET;
  const metrics = PROD_PORT_DEFAULTS.METRICS_PORT + DEV_OFFSET;
  const qdrant = PROD_PORT_DEFAULTS.QDRANT_HTTP + DEV_OFFSET;
  const redisPort = PROD_PORT_DEFAULTS.REDIS + DEV_OFFSET;
  const keycloak = PROD_PORT_DEFAULTS.KEYCLOAK + DEV_OFFSET;
  data.PORT = String(port);
  data.METRICS_PORT = String(metrics);
  data.AUTH_CALLBACK_BASE_URL = `http://localhost:${port}`;
  data.QDRANT_URL = `http://localhost:${qdrant}`;
  data.REDIS_URL = `redis://127.0.0.1:${redisPort}`;
  data.KEYCLOAK_URL = `http://localhost:${keycloak}`;
  data.AUTH_TRUSTED_ISSUERS = `http://localhost:${keycloak}/realms/kairos-dev`;
}

function isPlaceholder(v) {
  return v && PLACEHOLDER_RE.test(String(v).trim());
}

function replacePlaceholders(data, secretsResolved) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    const s = (v || '').trim();
    if (isPlaceholder(s)) {
      const name = s.match(PLACEHOLDER_RE)[1];
      out[k] = secretsResolved[name] ?? process.env[name] ?? '';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function writeEnvFile(path, data, keyOrder = null) {
  mkdirSync(dirname(path), { recursive: true });
  const keys = keyOrder ? [...keyOrder.filter((k) => k in data), ...Object.keys(data).filter((k) => !keyOrder.includes(k))] : Object.keys(data).sort();
  const lines = keys.map((k) => `${k}=${data[k]}`);
  writeFileSync(path, lines.join('\n') + '\n');
}

function writeTemplateFromBkp(bkpPath, outPath, secretKeys) {
  const lines = readEnvLines(bkpPath);
  const outLines = lines.map((line) => {
    const stripped = line.trim();
    const m = stripped.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && secretKeys.has(m[1])) return `${m[1]}=__${m[1]}__`;
    return line;
  });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, outLines.join('\n') + '\n');
}

function main() {
  const args = process.argv.slice(2);
  const writeTemplates = args.includes('--write-templates');
  const verify = args.includes('--verify');
  const force = args.includes('--force');

  const bkp = join(root, 'bkp');
  const envFile = join(root, '.env');
  const envDir = join(root, 'scripts', 'env');
  const envTpl = join(envDir, '.env.template');

  if (writeTemplates) {
    const bkpEnv = join(bkp, '.env');
    const bkpDev = join(bkp, '.env.dev');
    if (existsSync(bkpEnv) && existsSync(bkpDev)) {
      const merged = { ...parseEnvFile(bkpEnv), ...parseEnvFile(bkpDev) };
      const mergedPath = join(envDir, '.env.merged.bkp');
      writeEnvFile(mergedPath, merged);
      writeTemplateFromBkp(mergedPath, envTpl, new Set(SECRET_KEYS));
      try { unlinkSync(mergedPath); } catch (_) {}
    } else if (existsSync(bkpEnv)) {
      writeTemplateFromBkp(bkpEnv, envTpl, new Set(SECRET_KEYS));
    } else {
      process.stderr.write('bkp/.env (or bkp/.env + bkp/.env.dev) must exist to write template.\n');
      process.exit(1);
    }
    console.log('Wrote scripts/env/.env.template (secrets replaced by __VAR__).');
    return;
  }

  if (verify) {
    if (!existsSync(envFile)) {
      process.stderr.write('.env: file not found\n');
      process.exit(1);
    }
    const data = parseEnvFile(envFile);
    const required = ['REDIS_URL', 'QDRANT_URL', 'QDRANT_COLLECTION'].concat(
      SECRET_KEYS.filter((k) => ['KEYCLOAK_ADMIN_PASSWORD', 'KEYCLOAK_DB_PASSWORD'].includes(k))
    );
    const missing = required.filter((k) => !(data[k] || '').trim());
    if (missing.length) {
      process.stderr.write(`.env: missing or empty: ${missing.join(', ')}\n`);
      process.exit(1);
    }
    console.log('Verify OK: .env has required keys.');
    return;
  }

  const src = existsSync(envTpl) ? envTpl : join(bkp, '.env');
  if (!existsSync(src)) {
    process.stderr.write('Need scripts/env/.env.template or bkp/.env to generate .env\n');
    process.exit(1);
  }

  const existing = parseEnvFile(envFile);
  const secretsResolved = resolveSecrets(SECRET_KEYS, existing, force);
  let data = parseEnvFile(src);
  data = replacePlaceholders(data, secretsResolved);
  applyDevPorts(data);
  for (const k of SECRET_KEYS) {
    if (!(data[k] || '').trim()) data[k] = secretsResolved[k] ?? '';
  }

  const keyOrder = [];
  for (const line of readEnvLines(src)) {
    const s = line.trim();
    if (s.startsWith('#')) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && !keyOrder.includes(m[1])) keyOrder.push(m[1]);
  }

  data.AUTH_ENABLED = 'true';
  writeEnvFile(envFile, data, keyOrder.length ? keyOrder : null);
  console.log('Wrote .env (all enabled). Use for start/dev/infra and test:integration. Plain npm test uses AUTH_ENABLED=false REDIS_URL= overrides.');

  const dataAfter = parseEnvFile(envFile);
  const missing = ['REDIS_URL', 'QDRANT_URL', 'QDRANT_COLLECTION'].filter((k) => !(dataAfter[k] || '').trim());
  if (missing.length) {
    process.stderr.write(`.env: missing or empty after write: ${missing.join(', ')}\n`);
    process.exit(1);
  }
  console.log('Done. npm start / npm run dev / npm run infra:up use .env. npm test = memory + no auth (overrides). npm run test:integration = full .env.');
}

main();
