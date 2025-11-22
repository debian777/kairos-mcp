/**
 * Global process-level error handlers for KAIROS MCP
 * Captures uncaught exceptions, unhandled rejections, and Node warnings
 * and forwards them to the structured logger.
 */

import { structuredLogger } from './structured-logger.js';

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  process.on('uncaughtException', (err: any) => {
    try {
      structuredLogger.error('Uncaught exception', err instanceof Error ? err : new Error(String(err)));
    } catch { }
    // Do not exit immediately; allow supervisor to decide. Mark non-zero.
    process.exitCode = 1;
  });

  process.on('unhandledRejection', (reason: any) => {
    try {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      structuredLogger.error('Unhandled promise rejection', err);
    } catch { }
  });

  process.on('rejectionHandled', () => {
    try {
      structuredLogger.warn('Promise rejection handled asynchronously');
    } catch { }
  });

  process.on('multipleResolves', (type) => {
    try {
      structuredLogger.warn(`Multiple promise resolves detected: ${type}`);
    } catch { }
  });

  // Log Node warnings (e.g., ExperimentalWarning, DeprecationWarning)
  process.on('warning', (warning) => {
    try {
      const err = new Error(warning.message);
      (err as any).name = warning.name;
      // Only assign if defined to satisfy exactOptionalPropertyTypes
      if (typeof warning.stack === 'string') {
        (err as any).stack = warning.stack;
      }
      structuredLogger.warn(`Node warning: ${warning.name} - ${warning.message}`);
    } catch { }
  });
}
