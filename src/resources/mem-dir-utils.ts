import { readdir, readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { structuredLogger } from '../utils/structured-logger.js';

export const MEM_FILE_UUID_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getMemDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const baseDir = join(__dirname, '..', 'embed-docs', 'mem');
  return baseDir;
}

export function getMemDirFallback(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const parentDir = join(__dirname, '..');
  const otherName = basename(parentDir) === 'src' ? 'dist' : 'src';
  return join(parentDir, '..', otherName, 'embed-docs', 'mem');
}

export async function readMemFiles(memDir?: string): Promise<Record<string, string>> {
  const dir = memDir ?? getMemDir();
  const memResources: Record<string, string> = {};
  try {
    const files = await readdir(dir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    for (const file of mdFiles) {
      const filePath = join(dir, file);
      const key = file.replace(/\.md$/, '');
      const content = await readFile(filePath, 'utf-8');
      memResources[key] = content;
      structuredLogger.debug(`[mem-resources-boot] Loaded mem file: ${file} -> ${key}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      structuredLogger.warn(`[mem-resources-boot] Mem directory not found: ${dir}`);
    } else {
      structuredLogger.error(`[mem-resources-boot] Failed to read mem directory ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return memResources;
}