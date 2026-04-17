import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveKairosWorkDir } from '../../src/utils/kairos-work-dir-resolve.js';

const PKG = JSON.stringify({ name: '@debian777/kairos-mcp', version: '0.0.0-test' });

describe('resolveKairosWorkDir', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('honours absolute KAIROS_WORK_DIR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kairos-wd-abs-'));
    dirs.push(dir);
    const resolved = resolveKairosWorkDir({
      env: { KAIROS_WORK_DIR: join(dir, 'custom') },
      cwd: '/tmp'
    });
    expect(resolved).toBe(join(dir, 'custom'));
  });

  it('resolves relative KAIROS_WORK_DIR against cwd', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'kairos-wd-rel-cwd-'));
    dirs.push(cwd);
    const resolved = resolveKairosWorkDir({
      env: { KAIROS_WORK_DIR: 'rel-work' },
      cwd
    });
    expect(resolved).toBe(join(cwd, 'rel-work'));
  });

  it('uses repo-local .local/kairos/work when cwd is the kairos-mcp checkout', () => {
    const repo = mkdtempSync(join(tmpdir(), 'kairos-wd-repo-'));
    dirs.push(repo);
    writeFileSync(join(repo, 'package.json'), PKG, 'utf-8');
    const resolved = resolveKairosWorkDir({
      env: {},
      cwd: repo,
      runtimeDir: join(tmpdir(), 'orphan')
    });
    expect(resolved).toBe(join(repo, '.local', 'kairos', 'work'));
  });

  it('falls back to runtimeDir walk when cwd is outside the repo', () => {
    const repo = mkdtempSync(join(tmpdir(), 'kairos-wd-repo2-'));
    dirs.push(repo);
    writeFileSync(join(repo, 'package.json'), PKG, 'utf-8');
    const nested = join(repo, 'nested', 'deep');
    mkdirSync(nested, { recursive: true });
    const resolved = resolveKairosWorkDir({
      env: {},
      cwd: tmpdir(),
      runtimeDir: nested
    });
    expect(resolved).toBe(join(repo, '.local', 'kairos', 'work'));
  });

  it('uses XDG config kairos/work when not in repo', () => {
    const xdg = mkdtempSync(join(tmpdir(), 'kairos-wd-xdg-'));
    dirs.push(xdg);
    const orphan = mkdtempSync(join(tmpdir(), 'kairos-wd-orphan-'));
    dirs.push(orphan);
    const resolved = resolveKairosWorkDir({
      env: { XDG_CONFIG_HOME: xdg },
      cwd: orphan,
      runtimeDir: orphan
    });
    expect(resolved).toBe(join(xdg, 'kairos', 'work'));
  });
});
