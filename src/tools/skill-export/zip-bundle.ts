/**
 * Build a ZIP buffer from skill export files (root contains one folder per slug).
 */

import { ZipArchive } from 'archiver';
import type { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { getExportZipCompressionLevel } from '../../config/export-zip-settings.js';
import type { SkillExportFile } from './types.js';

function createSkillZipArchive() {
  return new ZipArchive({ zlib: { level: getExportZipCompressionLevel() } });
}

/**
 * Stream ZIP bytes into `destination` (e.g. HTTP `Response` or `PassThrough`).
 * Does not buffer the full archive in memory.
 */
export async function pipeSkillZipToWritable(
  destination: Writable,
  files: Array<{ path: string; content: string | Buffer }>
): Promise<void> {
  const archive = createSkillZipArchive();
  archive.on('error', (err: Error) => {
    destination.destroy(err);
  });
  archive.pipe(destination);
  for (const f of files) {
    const buf = typeof f.content === 'string' ? Buffer.from(f.content, 'utf8') : f.content;
    archive.append(buf, { name: f.path });
  }
  await archive.finalize();
  await finished(archive);
}

/**
 * Zip files (paths like `my-slug/SKILL.md`).
 */
export async function zipSkillFiles(files: Array<{ path: string; content: string | Buffer }>): Promise<Buffer> {
  const archive = createSkillZipArchive();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
  });
  for (const f of files) {
    const buf = typeof f.content === 'string' ? Buffer.from(f.content, 'utf8') : f.content;
    archive.append(buf, { name: f.path });
  }
  await archive.finalize();
  return done;
}

export function flattenSkillItemsToZipPaths(items: Array<{ slug: string; files: SkillExportFile[] }>): Array<{
  path: string;
  content: string | Buffer;
}> {
  const out: Array<{ path: string; content: string | Buffer }> = [];
  for (const item of items) {
    for (const f of item.files) {
      out.push({ path: `${item.slug}/${f.path}`, content: f.content });
    }
  }
  return out;
}
