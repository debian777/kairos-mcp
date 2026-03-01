#!/usr/bin/env node
/**
 * Stop the app process listening on PORT (from .env or default 3300).
 * Usage: node scripts/stop-by-port.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const root = join(new URL(import.meta.url).pathname, '..', '..');
const envPath = join(root, '.env');
let port = '3300';
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf8');
  const m = env.match(/^PORT=(\d+)/m);
  if (m) port = m[1];
}
try {
  const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
  const pids = out ? out.split(/\s+/).map((p) => Number(p)) : [];
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Stopped process ${pid} on port ${port}`);
    } catch (_) {
      // already gone
    }
  }
  if (pids.length === 0) console.log(`No process on port ${port}`);
} catch (e) {
  if (e.status === 1) {
    console.log(`No process on port ${port}`);
  } else {
    throw e;
  }
}
