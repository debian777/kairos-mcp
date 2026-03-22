#!/usr/bin/env node
/**
 * Tracks a SHA-256 fingerprint of lint-related config files. CI verifies the
 * working tree matches scripts/lint-config-fingerprint.sha256 so config edits
 * cannot land without an explicit fingerprint update (catches agent-only commits).
 *
 *   node scripts/lint-config-fingerprint.mjs verify   # default; exit 1 on mismatch
 *   node scripts/lint-config-fingerprint.mjs write    # refresh the .sha256 file
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FINGERPRINT_PATH = join(__dirname, 'lint-config-fingerprint.sha256');

/** Repo-root-relative paths that define ESLint / Knip behaviour. Keep sorted in compute(). */
const LINT_CONFIG_FILES = ['eslint.config.cjs', 'knip.config.ts'];

function computeLintConfigFingerprint(repoRoot) {
  const h = createHash('sha256');
  for (const rel of [...LINT_CONFIG_FILES].sort()) {
    const abs = join(repoRoot, rel);
    const buf = readFileSync(abs);
    h.update(rel);
    h.update('\0');
    h.update(buf);
    h.update('\0');
  }
  return h.digest('hex');
}

function main() {
  const cmd = process.argv[2] ?? 'verify';
  const repoRoot = process.cwd();

  if (cmd !== 'verify' && cmd !== 'write') {
    console.error(`Usage: node scripts/lint-config-fingerprint.mjs [verify|write]`);
    process.exit(2);
  }

  let actual;
  try {
    actual = computeLintConfigFingerprint(repoRoot);
  } catch (e) {
    console.error('lint-config-fingerprint: failed to read lint config files:', e.message);
    process.exit(1);
  }

  if (cmd === 'write') {
    writeFileSync(FINGERPRINT_PATH, `${actual}\n`, 'utf8');
    console.log(`Wrote ${FINGERPRINT_PATH}`);
    return;
  }

  let expected;
  try {
    expected = readFileSync(FINGERPRINT_PATH, 'utf8').trim();
  } catch {
    console.error(
      `lint-config-fingerprint: missing ${FINGERPRINT_PATH}\n` +
        'Run: node scripts/lint-config-fingerprint.mjs write'
    );
    process.exit(1);
  }

  if (actual !== expected) {
    console.error(
      'Lint configuration changed but scripts/lint-config-fingerprint.sha256 was not updated.\n' +
        `  expected (committed): ${expected}\n` +
        `  actual (workspace):   ${actual}\n` +
        'After reviewing eslint.config.cjs / knip.config.ts, run:\n' +
        '  node scripts/lint-config-fingerprint.mjs write\n' +
        'and commit the updated .sha256 file together with the config change.'
    );
    process.exit(1);
  }
}

main();
