#!/usr/bin/env node
/**
 * Run TypeScript check, Knip, UI tests, and Storybook build in parallel in CI;
 * append job summary for tsc, Knip, and Storybook after all finish (avoids concurrent writes to GITHUB_STEP_SUMMARY).
 * Vitest adds its own summary when CI=true.
 */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';

function appendSummary(title, ok, cmdLine) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const icon = ok ? '✅' : '❌';
  const body =
    `## ${title}\n\n` +
    `### Summary\n\n` +
    `- ${icon} **${cmdLine}** — ${ok ? 'passed' : 'failed'}\n\n`;
  appendFileSync(summaryPath, body, 'utf8');
}

function run(title, command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env, shell: false });
    child.on('close', (code) => resolve({ title, code: code ?? 1, cmdLine: [command, ...args].join(' ') }));
  });
}

const [tsc, knip, ui, storybook] = await Promise.all([
  run('TypeScript check', 'npx', ['tsc', '--noEmit']),
  run('Knip (compliance)', 'npm', ['run', 'knip']),
  run('Run UI tests', 'npm', ['run', 'test:ui']),
  run('Storybook build', 'npm', ['run', 'storybook:build']),
]);

appendSummary(tsc.title, tsc.code === 0, tsc.cmdLine);
appendSummary(knip.title, knip.code === 0, knip.cmdLine);
appendSummary(storybook.title, storybook.code === 0, storybook.cmdLine);

const exitCode = tsc.code || knip.code || ui.code || storybook.code ? 1 : 0;
process.exit(exitCode);
