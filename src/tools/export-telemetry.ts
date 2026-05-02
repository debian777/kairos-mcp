import { AsyncLocalStorage } from 'node:async_hooks';
import {
  hrtimeSecondsSince,
  recordExportMetrics
} from '../services/metrics/export-metrics.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { ExportInput, ExportOutput } from './export_schema.js';

const EXPORT_SLOW_MS = 5000;

export type ExportZipTraceStore = {
  decodedBytes?: number;
};

const exportZipTrace = new AsyncLocalStorage<ExportZipTraceStore>();

/**
 * Run export work (MCP `executeExport`, HTTP binary ZIP, etc.) with isolated
 * skill_zip byte accounting so concurrent exports cannot clobber each other's metrics.
 */
export function runExportTelemetryContext<T>(fn: () => Promise<T>): Promise<T> {
  return exportZipTrace.run({}, fn);
}

function getZipDecodedBytes(): number | undefined {
  return exportZipTrace.getStore()?.decodedBytes;
}

/** Used by unit tests to assert AsyncLocalStorage isolation. */
export function getExportZipTraceDecodedBytes(): number | undefined {
  return getZipDecodedBytes();
}

export function setSkillZipDecodedBytes(n: number): void {
  const store = exportZipTrace.getStore();
  if (store) {
    store.decodedBytes = n;
  }
}

export function finalizeExportObservation(
  input: ExportInput,
  result: ExportOutput | undefined,
  t0: bigint,
  caught: unknown
): void {
  const durationSec = hrtimeSecondsSince(t0);
  const durationMs = Math.round(durationSec * 1000);
  const ok = caught === undefined;
  const adapterCount =
    ok && result !== undefined
      ? result.export_adapter_count ?? result.item_count
      : undefined;
  const traceBytes = getZipDecodedBytes();
  const zipBytes = ok && result?.format === 'skill_zip' ? traceBytes : undefined;
  recordExportMetrics({
    format: input.format,
    status: ok ? 'success' : 'error',
    durationSec,
    ...(typeof adapterCount === 'number' ? { adapterCount } : {}),
    ...(typeof zipBytes === 'number' ? { skillZipDecodedBytes: zipBytes } : {})
  });
  logExportFinished(input, result, durationMs, caught, traceBytes);
}

function logExportFinished(
  input: ExportInput,
  result: ExportOutput | undefined,
  durationMs: number,
  caught: unknown,
  skillZipDecoded?: number
): void {
  const base = {
    event: 'export_complete',
    format: input.format,
    duration_ms: durationMs,
    export_adapter_count: result?.export_adapter_count ?? result?.item_count
  };
  if (caught !== undefined) {
    structuredLogger.warn(
      {
        ...base,
        status: 'error',
        err: caught instanceof Error ? caught.message : String(caught)
      },
      'export failed'
    );
    return;
  }
  const slow = durationMs >= EXPORT_SLOW_MS;
  if (result?.format === 'skill_zip') {
    const line = slow ? 'export slow (threshold exceeded)' : 'export completed';
    const logFn = slow ? structuredLogger.warn.bind(structuredLogger) : structuredLogger.info.bind(structuredLogger);
    logFn(
      {
        ...base,
        status: 'success',
        skill_zip_base64_chars: result.content && result.content.length > 0 ? result.content.length : undefined,
        skill_zip_decoded_bytes: skillZipDecoded,
        bundle_sha256: result.bundle_sha256,
        slow_export: slow
      },
      line
    );
    return;
  }
  if (slow) {
    structuredLogger.warn({ ...base, status: 'success', slow_export: true }, 'export slow (threshold exceeded)');
  } else {
    structuredLogger.info({ ...base, status: 'success' }, 'export completed');
  }
}
