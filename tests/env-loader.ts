/**
 * Load .env into process.env before any tests run.
 * Ensures the test process sees the same env as the server (deploy-run-env.sh sources
 * the same file). Run before dotenv/config so ENV-specific file wins.
 * Fixes CI/local cases where Jest workers or globalSetup would otherwise miss vars.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

function normalizeRedisUrl(rawUrl: string | undefined, rawPassword: string | undefined): string {
  const url = (rawUrl || '').trim();
  const password = (rawPassword || '').trim();
  if (!url || !password) return url;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') || parsed.username || parsed.password) {
      return url;
    }
    parsed.password = password;
    return parsed.toString();
  } catch {
    return url;
  }
}

const env = process.env.ENV;
const root = process.cwd();

if (env) {
  const envFile = join(root, `.env.${env}`);
  if (existsSync(envFile)) {
    config({ path: envFile, override: false });
  }
}

const baseEnvFile = join(root, '.env');
if (existsSync(baseEnvFile)) {
  config({ path: baseEnvFile, override: false });
}

const normalizedRedisUrl = normalizeRedisUrl(process.env.REDIS_URL, process.env.REDIS_PASSWORD);
if (normalizedRedisUrl) {
  process.env.REDIS_URL = normalizedRedisUrl;
}
