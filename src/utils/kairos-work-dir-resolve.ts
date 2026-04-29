/**
 * Resolve the canonical local artifact directory for shell challenges and
 * authoring flows.
 *
 * Agents use this path to exchange temporary local files between adapter
 * layers and subagents. It is not a process cwd or Docker WORKDIR.
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

export const KAIROS_LOCAL_ARTIFACT_DIR_ENV = 'KAIROS_LOCAL_ARTIFACT_DIR';
export const KAIROS_WORK_DIR_ENV = 'KAIROS_WORK_DIR';

export type LocalArtifactDirResolution = {
  path: string;
  source: 'canonical_env' | 'compat_env' | 'repo_default' | 'user_config_default';
  usedCompatAlias: boolean;
};

/**
 * - If `KAIROS_LOCAL_ARTIFACT_DIR` is set: resolve (relative paths against `cwd`).
 * - Else if compat alias `KAIROS_WORK_DIR` is set: resolve it the same way and
 *   mark the compat alias as used.
 * - Else if this checkout is the kairos-mcp repo: `<repo>/.local/kairos/work`
 * - Else: `<getKairosConfigDir()>/work`
 */
export function resolveLocalArtifactDir(
  opts?: ResolveKairosWorkDirOptions
): LocalArtifactDirResolution {
  const env = opts?.env ?? process.env;
  const cwd = opts?.cwd ?? process.cwd();
  const runtimeDir = opts?.runtimeDir;

  const canonicalRaw = env[KAIROS_LOCAL_ARTIFACT_DIR_ENV]?.trim();
  if (canonicalRaw) {
    return {
      path: isAbsolute(canonicalRaw) ? canonicalRaw : resolve(cwd, canonicalRaw),
      source: 'canonical_env',
      usedCompatAlias: false
    };
  }

  const compatRaw = env[KAIROS_WORK_DIR_ENV]?.trim();
  if (compatRaw) {
    return {
      path: isAbsolute(compatRaw) ? compatRaw : resolve(cwd, compatRaw),
      source: 'compat_env',
      usedCompatAlias: true
    };
  }

  const repoRoot =
    findKairosMcpRepoRootFrom(cwd) ??
    (runtimeDir ? findKairosMcpRepoRootFrom(runtimeDir) : null);
  if (repoRoot) {
    return {
      path: join(repoRoot, '.local', 'kairos', 'work'),
      source: 'repo_default',
      usedCompatAlias: false
    };
  }

  return {
    path: join(getKairosConfigDir(env), 'work'),
    source: 'user_config_default',
    usedCompatAlias: false
  };
}

export function resolveKairosWorkDir(opts?: ResolveKairosWorkDirOptions): string {
  return resolveLocalArtifactDir(opts).path;
}
