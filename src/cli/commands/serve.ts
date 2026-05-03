/**
 * kairos serve — start the HTTP/MCP server from the same bootstrap as `node dist/index.js`.
 */

import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { config as dotenvConfig } from 'dotenv';
import { writeStderr } from '../output.js';

export function serveCommand(program: Command): void {
  program
    .command('serve')
    .description(
      'Start the KAIROS HTTP/MCP server (Qdrant, embedding env, optional Redis — same contract as Docker Compose / dev:start:installed). Root --url does not set the listen address; use PORT / --port.'
    )
    .option('--env-file <path>', 'Path to dotenv file', '.env')
    .option('--port <n>', 'HTTP listen port (sets PORT)')
    .option('--metrics-port <n>', 'Metrics listen port (sets METRICS_PORT)')
    .action(async (opts: { envFile?: string; port?: string; metricsPort?: string }) => {
      try {
        const envPath = opts.envFile ?? '.env';
        if (existsSync(envPath)) {
          dotenvConfig({ path: envPath });
        }
        if (opts.port !== undefined && opts.port !== '') {
          const n = parseInt(opts.port, 10);
          if (!Number.isFinite(n) || n < 1) {
            writeStderr(`Invalid --port: ${opts.port}`);
            process.exit(1);
          }
          process.env['PORT'] = String(n);
        }
        if (opts.metricsPort !== undefined && opts.metricsPort !== '') {
          const n = parseInt(opts.metricsPort, 10);
          if (!Number.isFinite(n) || n < 1) {
            writeStderr(`Invalid --metrics-port: ${opts.metricsPort}`);
            process.exit(1);
          }
          process.env['METRICS_PORT'] = String(n);
        }
        const { runKairosServer } = await import('../../index.js');
        await runKairosServer();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        writeStderr(msg);
        process.exit(1);
      }
    });
}
