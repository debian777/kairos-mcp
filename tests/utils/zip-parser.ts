/**
 * Minimal ZIP central-directory reader for tests. Supports stored (method 0) and deflate (method 8).
 * Avoids adding a runtime dependency just for asserting ZIP layout.
 *
 * Only used to validate exported skill bundles — input always comes from this server's archiver,
 * not from arbitrary user input, so the parser does not need to harden against adversarial ZIPs.
 */

import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  path: string;
  /** ZIP compression method: 0 = store, 8 = deflate. */
  method: number;
  /** Raw uncompressed bytes for the entry. */
  content: Buffer;
}

const EOCD_SIGNATURE = 0x06054b50;
const CDFH_SIGNATURE = 0x02014b50;
const LFH_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectoryOffset(buf: Buffer): number {
  // EOCD comment is 0..0xFFFF bytes; scan from the end backwards for the signature.
  const minOffset = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= minOffset; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      return i;
    }
  }
  throw new Error('end of central directory record not found in ZIP buffer');
}

/**
 * Parse the ZIP central directory and return all file entries with their decompressed content.
 */
export function parseZipEntries(buf: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectoryOffset(buf);
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdEnd = cdOffset + cdSize;

  const out: ZipEntry[] = [];
  let cursor = cdOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (cursor + 46 > cdEnd) {
      throw new Error(`central directory header ${i} truncated`);
    }
    const sig = buf.readUInt32LE(cursor);
    if (sig !== CDFH_SIGNATURE) {
      throw new Error(`central directory header ${i} has bad signature 0x${sig.toString(16)}`);
    }
    const method = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const fileNameLength = buf.readUInt16LE(cursor + 28);
    const extraLength = buf.readUInt16LE(cursor + 30);
    const commentLength = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const filePath = buf.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');
    cursor += 46 + fileNameLength + extraLength + commentLength;

    if (filePath.endsWith('/')) {
      // Directory entry — skip; we only care about files in skill bundles.
      continue;
    }

    const lfhSig = buf.readUInt32LE(localHeaderOffset);
    if (lfhSig !== LFH_SIGNATURE) {
      throw new Error(
        `local file header for "${filePath}" has bad signature 0x${lfhSig.toString(16)}`
      );
    }
    const lfhFileNameLength = buf.readUInt16LE(localHeaderOffset + 26);
    const lfhExtraLength = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lfhFileNameLength + lfhExtraLength;
    const dataEnd = dataStart + compressedSize;
    const compressedBytes = buf.subarray(dataStart, dataEnd);

    let content: Buffer;
    if (method === 0) {
      content = Buffer.from(compressedBytes);
    } else if (method === 8) {
      content = Buffer.from(inflateRawSync(compressedBytes));
    } else {
      throw new Error(`unsupported compression method ${method} for "${filePath}"`);
    }
    if (content.length !== uncompressedSize) {
      throw new Error(
        `entry "${filePath}" decompressed size ${content.length} does not match header ${uncompressedSize}`
      );
    }
    out.push({ path: filePath, method, content });
  }
  return out;
}

/**
 * Convenience: index entries by path for quick assertions.
 */
export function indexZipEntriesByPath(buf: Buffer): Map<string, ZipEntry> {
  const map = new Map<string, ZipEntry>();
  for (const e of parseZipEntries(buf)) {
    map.set(e.path, e);
  }
  return map;
}
