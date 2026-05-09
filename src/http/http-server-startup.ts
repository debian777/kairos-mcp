import type { Server } from 'node:http';
import { writeFileSync } from 'node:fs';
import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';

function persistListenPortForDevOrchestration(listenPort: number): void {
  const path = process.env['KAIROS_DEV_LISTEN_PORT_FILE']?.trim();
  if (!path) return;
  try {
    writeFileSync(path, `${listenPort}\n`, 'utf8');
  } catch (err) {
    structuredLogger.warn(
      `[http] Could not write KAIROS_DEV_LISTEN_PORT_FILE (${path}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Start HTTP server with error handling.
 * @param app Express application instance
 * @param port Fixed port, or `'auto'` to bind port 0 and use the OS-assigned port.
 * @returns HTTP server instance and the bound TCP port.
 */
export function startHttpServerWithErrorHandling(
  app: express.Express,
  port: number | 'auto'
): Promise<{ server: Server; listenPort: number }> {
  const bindArg = port === 'auto' ? 0 : port;

  return new Promise((resolve) => {
    const httpServer = app.listen(bindArg, '0.0.0.0', () => {
      const addr = httpServer.address();
      const listenPort =
        typeof addr === 'object' && addr !== null && 'port' in addr && typeof addr.port === 'number'
          ? addr.port
          : bindArg;

      process.env['PORT'] = String(listenPort);
      persistListenPortForDevOrchestration(listenPort);

      if (port === 'auto') {
        structuredLogger.info(
          `PORT=AUTO: bound ephemeral TCP port ${listenPort} (set process.env.PORT for downstream tools)`
        );
      }

      structuredLogger.success('HTTP server', 'listening on port ' + listenPort);
      structuredLogger.info('Health check: http://localhost:' + listenPort + '/health');
      structuredLogger.info('MCP endpoint: http://localhost:' + listenPort + '/mcp');

      resolve({ server: httpServer, listenPort });
    });

    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        const requested = port === 'auto' ? 'ephemeral (AUTO)' : String(port);
        const hint =
          port !== 'auto'
            ? ' Choose a different PORT, stop the other listener, or set PORT=AUTO for an OS-assigned free port.'
            : '';
        structuredLogger.error(
          `Port bind failed (${requested}): address already in use.${hint}`
        );
      } else {
        structuredLogger.error('HTTP server error:', error.message);
      }
      process.exit(1);
    });
  });
}
