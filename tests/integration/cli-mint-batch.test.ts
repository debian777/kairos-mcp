/**
 * CLI mint batch: directory and --recursive
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  execAsync,
  BASE_URL,
  CLI_PATH,
  setupServerCheck,
  setupCliConfigWithLogin
} from './cli-commands-shared.js';

function minimalProtocolMd(title: string): string {
  return `# ${title}

## Natural Language Triggers

Run when user says "${title}".

## Step 1: Setup

Basic setup.

\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo ok","timeout_seconds":5},"required":true}}
\`\`\`

## Completion Rule

Done.
`;
}

describe('CLI mint directory batch', () => {
  let serverAvailable = false;
  let cliLoggedIn = false;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    cliLoggedIn = await setupCliConfigWithLogin();
  }, 60000);

  test('mint directory mints all root .md files and returns batch JSON', async () => {
    if (!serverAvailable || !cliLoggedIn) return;

    const ts = Date.now();
    const dir = mkdtempSync(join(tmpdir(), 'kairos-mint-batch-'));
    try {
      writeFileSync(join(dir, 'z-second.md'), minimalProtocolMd(`CLI Batch Z ${ts}`), 'utf-8');
      writeFileSync(join(dir, 'a-first.md'), minimalProtocolMd(`CLI Batch A ${ts}`), 'utf-8');

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force "${dir}"`,
        { timeout: 120000 }
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout) as {
        batch: boolean;
        root: string;
        results: Array<{ path: string; ok: boolean; status?: string; items?: unknown[]; error?: string }>;
      };
      expect(result.batch).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.path).toBe('a-first.md');
      expect(result.results[1]!.path).toBe('z-second.md');
      expect(result.results.every(r => r.ok)).toBe(true);
      expect(result.results.every(r => r.status === 'stored')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  test('mint --recursive includes nested .md files', async () => {
    if (!serverAvailable || !cliLoggedIn) return;

    const ts = Date.now();
    const dir = mkdtempSync(join(tmpdir(), 'kairos-mint-rec-'));
    try {
      mkdirSync(join(dir, 'nested'), { recursive: true });
      writeFileSync(join(dir, 'root.md'), minimalProtocolMd(`CLI Rec Root ${ts}`), 'utf-8');
      writeFileSync(join(dir, 'nested', 'deep.md'), minimalProtocolMd(`CLI Rec Deep ${ts}`), 'utf-8');

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force --recursive "${dir}"`,
        { timeout: 120000 }
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout) as {
        batch: boolean;
        results: Array<{ path: string; ok: boolean }>;
      };
      expect(result.batch).toBe(true);
      expect(result.results).toHaveLength(2);
      const paths = result.results.map(r => r.path).sort();
      expect(paths).toEqual(['nested/deep.md', 'root.md']);
      expect(result.results.every(r => r.ok)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  test('mint --recursive skips README.md at root and in subdirs', async () => {
    if (!serverAvailable || !cliLoggedIn) return;

    const ts = Date.now();
    const dir = mkdtempSync(join(tmpdir(), 'kairos-mint-readme-rec-'));
    try {
      mkdirSync(join(dir, 'nested'), { recursive: true });
      writeFileSync(join(dir, 'root.md'), minimalProtocolMd(`CLI ReadmeRec Root ${ts}`), 'utf-8');
      writeFileSync(join(dir, 'nested', 'deep.md'), minimalProtocolMd(`CLI ReadmeRec Deep ${ts}`), 'utf-8');
      writeFileSync(join(dir, 'README.md'), '# Human docs only\n', 'utf-8');
      writeFileSync(join(dir, 'nested', 'README.md'), '# Nested readme\n', 'utf-8');

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force --recursive "${dir}"`,
        { timeout: 120000 }
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout) as {
        batch: boolean;
        results: Array<{ path: string; ok: boolean }>;
      };
      expect(result.batch).toBe(true);
      expect(result.results).toHaveLength(2);
      const paths = result.results.map(r => r.path).sort();
      expect(paths).toEqual(['nested/deep.md', 'root.md']);
      expect(result.results.every(r => r.ok)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  test('mint directory batch skips root README.md only', async () => {
    if (!serverAvailable || !cliLoggedIn) return;

    const ts = Date.now();
    const dir = mkdtempSync(join(tmpdir(), 'kairos-mint-readme-flat-'));
    try {
      writeFileSync(join(dir, 'a.md'), minimalProtocolMd(`CLI ReadmeFlat A ${ts}`), 'utf-8');
      writeFileSync(join(dir, 'README.md'), '# Human docs\n', 'utf-8');

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force "${dir}"`,
        { timeout: 120000 }
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout) as { batch: boolean; results: Array<{ path: string }> };
      expect(result.batch).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.path).toBe('a.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  test('mint without --recursive skips nested .md', async () => {
    if (!serverAvailable || !cliLoggedIn) return;

    const ts = Date.now();
    const dir = mkdtempSync(join(tmpdir(), 'kairos-mint-flat-'));
    try {
      mkdirSync(join(dir, 'nested'), { recursive: true });
      writeFileSync(join(dir, 'only-root.md'), minimalProtocolMd(`CLI Flat Root ${ts}`), 'utf-8');
      writeFileSync(join(dir, 'nested', 'skip.md'), minimalProtocolMd(`CLI Flat Skip ${ts}`), 'utf-8');

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force "${dir}"`,
        { timeout: 120000 }
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout) as { batch: boolean; results: unknown[] };
      expect(result.batch).toBe(true);
      expect(result.results).toHaveLength(1);
      expect((result.results[0] as { path: string }).path).toBe('only-root.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  test('mint empty directory exits with error', async () => {
    if (!serverAvailable || !cliLoggedIn) return;

    const dir = mkdtempSync(join(tmpdir(), 'kairos-mint-empty-'));
    try {
      try {
        await execAsync(`node ${CLI_PATH} train --url ${BASE_URL} "${dir}"`, { timeout: 30000 });
        expect(true).toBe(false);
      } catch (e: unknown) {
        const err = e as { code?: number; stderr?: string };
        expect(err.code).toBe(1);
        expect(String(err.stderr ?? '')).toMatch(/No \.md files/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
