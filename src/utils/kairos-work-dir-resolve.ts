/**
 * Resolve the canonical on-disk work directory for shell challenges and authoring flows.
 * Agents should export `KAIROS_WORK_DIR` to this path before running shell contracts.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';
import { getKairosConfigDir } from './kairos-user-dirs.js';

function isKairosMcpRepoRoot(dir: string): boolean {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const parsed = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string };
    return parsed.name === '@debian777/kairos-mcp';
  } catch {
    return false;
  }
}

function findKairosMcpRepoRootFrom(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    if (isKairosMcpRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type ResolveKairosWorkDirOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Directory of the caller module (fallback walk when cwd is outside the repo). */
  runtimeDir?: string;
};

/**
 * - If `KAIROS_WORK_DIR` is set: resolve (relative paths against `cwd`).
 * - Else if this checkout is the kairos-mcp repo: `<repo>/.local/kairos/work`
 * - Else: `<getKairosConfigDir()>/work`
 */
export function resolveKairosWorkDir(opts?: ResolveKairosWorkDirOptions): string {
  const env = opts?.env ?? process.env;
  const cwd = opts?.cwd ?? process.cwd();
  const runtimeDir = opts?.runtimeDir;

  const raw = env['KAIROS_WORK_DIR']?.trim();
  if (raw) {
    return isAbsolute(raw) ? raw : resolve(cwd, raw);
  }

  const repoRoot =
    findKairosMcpRepoRootFrom(cwd) ??
    (runtimeDir ? findKairosMcpRepoRootFrom(runtimeDir) : null);
  if (repoRoot) {
    return join(repoRoot, '.local', 'kairos', 'work');
  }

  return join(getKairosConfigDir(env), 'work');
}
