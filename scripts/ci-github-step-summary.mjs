#!/usr/bin/env node
/**
 * Run a command and append a GitHub Actions job summary section (Vitest-style headings).
 * Only writes when GITHUB_STEP_SUMMARY is set (GitHub Actions).
 *
 * Usage:
 *   node scripts/ci-github-step-summary.mjs "Section title" -- <command> [args...]
 *
 * Example:
 *   node scripts/ci-github-step-summary.mjs "TypeScript check" -- npx tsc --noEmit
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 1 || sep === argv.length - 1) {
  console.error(
    'Usage: node scripts/ci-github-step-summary.mjs "Section title" -- <command> [args...]\n' +
      'Example: node scripts/ci-github-step-summary.mjs "Knip" -- npm run knip'
  );
  process.exit(2);
}

const title = argv.slice(0, sep).join(' ');
const command = argv[sep + 1];
const cmdArgs = argv.slice(sep + 2);
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

const result = spawnSync(command, cmdArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: false
});

const code = result.status ?? 1;
const ok = code === 0;
const icon = ok ? '✅' : '❌';
const cmdLine = [command, ...cmdArgs].join(' ');

if (summaryPath) {
  const body =
    `## ${title}\n\n` +
    `### Summary\n\n` +
    `- ${icon} **${cmdLine}** — ${ok ? 'passed' : 'failed'}\n\n`;
  appendFileSync(summaryPath, body, 'utf8');
}

process.exit(code);
