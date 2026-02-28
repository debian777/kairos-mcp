/**
 * Load .env.${ENV} (e.g. .env.dev) into process.env before any tests run.
 * Ensures the test process sees the same env as the server (run-env.sh sources
 * the same file). Run before dotenv/config so ENV-specific file wins.
 * Fixes CI/local cases where Jest workers or globalSetup would otherwise miss vars.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const env = process.env.ENV;
const root = process.cwd();

if (env) {
  const envFile = join(root, `.env.${env}`);
  if (existsSync(envFile)) {
    config({ path: envFile, override: true });
  }
}
