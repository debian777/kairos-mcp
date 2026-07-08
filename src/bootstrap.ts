/**
 * Bootstrap entry: installs process error handlers before any app code loads,
 * so uncaught exceptions during import (e.g. [Object: null prototype]) are
 * logged with a readable message instead of Node's default dump.
 * Then dynamically imports index.js and awaits runKairosServer() (argv[1] is bootstrap.js, so index's isDirectRun() is false).
 * Uses process.stderr (not console) so verify-clean-source allows this file.
 * Handlers are registered immediately (first statements) so they run before any import().
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Write PID so the test runner's globalTeardown can kill this process after tests complete.
// Without this, the stdio child's open pipes keep Jest's event loop alive indefinitely,
// causing CI to hang for hours. The test runner reads .test-stdio-child.pid and sends SIGTERM.
if (process.env['TRANSPORT_TYPE'] === 'stdio') {
  try {
    writeFileSync(join(process.cwd(), '.test-stdio-child.pid'), String(process.pid));
  } catch {
    // non-critical: if we can't write the PID file, globalTeardown won't find us
  }
}

function stderr(msg: string): void {
  process.stderr.write(`${msg}\n`);
}
function safeStringify(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ''}`;
  if (typeof v === 'object' && v !== null) {
    try {
      const o = v as Record<string, unknown>;
      const msg = typeof o['message'] === 'string' ? o['message'] : undefined;
      const stack = typeof o['stack'] === 'string' ? o['stack'] : undefined;
      const code = o['code'] !== undefined ? String(o['code']) : undefined;
      if (msg || stack || code) {
        const parts = [code ? `code=${code}` : '', msg ?? '', stack ?? ''].filter(Boolean);
        return parts.join('\n');
      }
    } catch {
      // fall through
    }
    try {
      const j = JSON.stringify(v);
      if (j !== '{}') return j;
    } catch {
      // fall through
    }
    return Object.prototype.toString.call(v);
  }
  return String(v);
}
process.on('uncaughtException', (err: unknown) => {
  try {
    stderr(`[bootstrap] Uncaught exception: ${safeStringify(err)}`);
  } catch {
    stderr('[bootstrap] Uncaught exception (unserializable)');
  }
  process.exitCode = 1;
});
process.on('unhandledRejection', (reason: unknown) => {
  try {
    stderr(`[bootstrap] Unhandled rejection: ${safeStringify(reason)}`);
  } catch {
    stderr('[bootstrap] Unhandled rejection (unserializable)');
  }
});

const { runKairosServer } = await import('./index.js');
await runKairosServer();
