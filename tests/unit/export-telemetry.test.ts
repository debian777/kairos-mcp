import { describe, expect, it } from '@jest/globals';
import {
  getExportZipTraceDecodedBytes,
  runExportTelemetryContext,
  setSkillZipDecodedBytes
} from '../../src/tools/export-telemetry.js';

describe('export-telemetry AsyncLocalStorage', () => {
  it('isolates skill_zip decoded byte counts across concurrent exports', async () => {
    const results = await Promise.all([
      runExportTelemetryContext(async () => {
        setSkillZipDecodedBytes(100);
        await new Promise<void>((r) => setImmediate(r));
        return getExportZipTraceDecodedBytes();
      }),
      runExportTelemetryContext(async () => {
        setSkillZipDecodedBytes(200);
        await new Promise<void>((r) => setImmediate(r));
        return getExportZipTraceDecodedBytes();
      })
    ]);
    expect(results.sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([100, 200]);
  });
});
