/**
 * Helpers for AI-MCP integration reports: path containment plus proof shaping
 * and redaction so markdown output captures tool flow without persisting raw
 * server payloads or obvious secret material.
 */
import fs from 'fs';
import path from 'path';

const DMAX = 8;
const SMAX = 2_048;
const AMAX = 50;
const KMAX = 40;
const MAX_REPORT_BYTES = 4 * 1024 * 1024;
const REDACTED = '[redacted]';
const SENSITIVE_KEY_RE = /(authorization|bearer|token|password|secret|cookie|set-cookie)/i;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

function sanitizeSingleLine(text, maxLen = SMAX) {
  const trimmed = String(text).slice(0, maxLen).replace(/[\r\n\t\x00-\x1f]/g, ' ');
  return trimmed.replace(/\s+/g, ' ').trim() || '(empty)';
}

function redactUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    const hadQuery = Boolean(parsed.search);
    parsed.search = '';
    parsed.hash = '';
    return hadQuery ? `${parsed.toString()}?[redacted]` : parsed.toString();
  } catch {
    return value;
  }
}

function sanitizeProofString(value, key = '') {
  if (SENSITIVE_KEY_RE.test(key)) return REDACTED;
  let next = sanitizeSingleLine(value);
  next = next.replace(JWT_RE, REDACTED);
  next = next.replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, `Bearer ${REDACTED}`);
  return /^https?:\/\//i.test(next) ? redactUrl(next) : next;
}

export function snapshotForIntegrationReport(value, depth = 0, seen = new WeakSet(), key = '') {
  if (depth > DMAX) return '[max depth]';
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'string') return sanitizeProofString(value, key);
  if (t === 'number') return Number.isFinite(value) ? value : null;
  if (t === 'boolean') return value;
  if (t === 'bigint') return value.toString();
  if (t !== 'object') return sanitizeSingleLine(String(value), 256);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  try {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      const n = Math.min(value.length, AMAX);
      const out = [];
      for (let i = 0; i < n; i++) out.push(snapshotForIntegrationReport(value[i], depth + 1, seen, key));
      if (value.length > AMAX) out.push(`…[${value.length - AMAX} more items omitted]`);
      return out;
    }
    const out = {};
    const keys = Object.keys(value);
    const limit = Math.min(keys.length, KMAX);
    for (let i = 0; i < limit; i++) {
      const k = keys[i];
      out[k] = snapshotForIntegrationReport(value[k], depth + 1, seen, k);
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
