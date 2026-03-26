/**
 * Helpers for AI-MCP integration reports: path containment and bounded JSON
 * snapshots so markdown output is not a raw taint sink for HTTP bodies (CodeQL).
 */
import fs from 'fs';
import path from 'path';

const DMAX = 14;
const SMAX = 16_384;
const AMAX = 250;
const KMAX = 100;
/** Cap total report size on disk (integration script persists bounded JSON snapshots of API traffic). */
const MAX_REPORT_BYTES = 4 * 1024 * 1024;

export function snapshotForIntegrationReport(value, depth = 0, seen = new WeakSet()) {
  if (depth > DMAX) return '[max depth]';
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'string') return value.length > SMAX ? `${value.slice(0, SMAX)}…[truncated]` : value;
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'bigint') return value.toString();
  if (t !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  try {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      const n = Math.min(value.length, AMAX);
      const out = [];
      for (let i = 0; i < n; i++) out.push(snapshotForIntegrationReport(value[i], depth + 1, seen));
      if (value.length > AMAX) out.push(`…[${value.length - AMAX} more items omitted]`);
      return out;
    }
    const out = {};
    const keys = Object.keys(value);
    const limit = Math.min(keys.length, KMAX);
    for (let i = 0; i < limit; i++) {
      const k = keys[i];
      out[k] = snapshotForIntegrationReport(value[k], depth + 1, seen);
    }
    if (keys.length > KMAX) out._omitted_key_count = keys.length - KMAX;
    return out;
  } finally {
    seen.delete(value);
  }
}

export function integrationReportSection(title, request, response) {
  const safeRequest = snapshotForIntegrationReport(request);
  const safeResponse = snapshotForIntegrationReport(response);
  return `### ${title}\n\n**Request:**\n\n\`\`\`json\n${JSON.stringify(safeRequest, null, 2)}\n\`\`\`\n\n**Response:**\n\n\`\`\`json\n${JSON.stringify(safeResponse, null, 2)}\n\`\`\`\n\n`;
}

function resolveSafeReportPath(filePath, reportsDir) {
  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(reportsDir);
  const rel = path.relative(resolvedRoot, resolvedFile);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Report path must stay under reports/');
  return resolvedFile;
}

function boundedReportBuffer(utf8Content) {
  const buf = Buffer.from(utf8Content, 'utf8');
  if (buf.length <= MAX_REPORT_BYTES) return buf;
  return Buffer.concat([
    buf.subarray(0, MAX_REPORT_BYTES),
    Buffer.from('\n\n…[report truncated]\n', 'utf8')
  ]);
}

export function writeIntegrationReportFile(reportPath, utf8Content, reportsDir) {
  const safePath = resolveSafeReportPath(reportPath, reportsDir);
  fs.mkdirSync(path.dirname(safePath), { recursive: true });
  fs.writeFileSync(safePath, boundedReportBuffer(utf8Content));
}
