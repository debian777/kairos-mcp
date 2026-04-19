/**
 * Run the KAIROS MCP server process (same entry as bootstrap/index).
 * Transport: --transport wins over TRANSPORT_TYPE; default for this command is stdio.
 * HTTP listen port: --api-port wins over API_PORT, then PORT (matches server config resolution).
 * Other CLI commands do not read --transport or --api-port; they are unaffected unless those env vars are set in the shell.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { writeConfig } from '../config-file.js';

const VALID = new Set(['stdio', 'http']);

export type ServeTransport = 'stdio' | 'http';

/**
 * Resolve MCP transport for `kairos serve`: CLI --transport > TRANSPORT_TYPE > defaultStdio.
 */
function parseListenPort(raw: string, label: string): number {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid ${label} port "${raw}" (use 1–65535)`);
  }
  return n;
}

/**
 * Resolve HTTP app listen port for `kairos serve`: CLI --api-port > API_PORT > PORT > unset (inherit in child).
 */
export function resolveServeApiPort(cliApiPort: string | undefined): number | undefined {
  const trimmed = cliApiPort?.trim();
  if (trimmed) {
    return parseListenPort(trimmed, '--api-port');
  }
  const api = process.env['API_PORT']?.trim();
  if (api) {
    return parseListenPort(api, 'API_PORT');
  }
  const fromPortEnv = process.env['PORT']?.trim();
  if (fromPortEnv) {
    return parseListenPort(fromPortEnv, 'PORT');
  }
  return undefined;
}

export function resolveServeTransport(cliTransport: string | undefined, defaultStdio = true): ServeTransport {
  const trimmed = cliTransport?.trim().toLowerCase();
  if (trimmed) {
    if (!VALID.has(trimmed)) {
      throw new Error(`Invalid --transport "${cliTransport}" (use stdio or http)`);
    }
    return trimmed as ServeTransport;
  }
  const fromEnv = process.env['TRANSPORT_TYPE']?.trim().toLowerCase();
  if (fromEnv && VALID.has(fromEnv)) {
    return fromEnv as ServeTransport;
  }
  return defaultStdio ? 'stdio' : 'http';
}

function findPackageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const pkgJson = path.join(dir, 'package.json');
    if (existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, 'utf8')) as { name?: string };
        if (pkg.name === '@debian777/kairos-mcp') {
          return dir;
        }
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function bootstrapEntry(root: string): string[] {
  const distBootstrap = path.join(root, 'dist', 'bootstrap.js');
  if (existsSync(distBootstrap)) {
    return [distBootstrap];
  }
  const srcBootstrap = path.join(root, 'src', 'bootstrap.ts');
  return ['--loader', 'ts-node/esm', srcBootstrap];
}

export function serveCommand(program: Command): void {
  program
    .command('serve')
    .description('Run the KAIROS MCP server (HTTP or stdio transport)')
    .option(
      '--transport <mode>',
      'Transport: stdio or http (overrides TRANSPORT_TYPE for this process)'
    )
    .option(
      '--api-port <port>',
      'HTTP app listen port (sets API_PORT for this process; with --api-port, updates CLI defaultUrl)'
    )
    .action(async (options: { transport?: string; apiPort?: string }) => {
      const envBefore = process.env['TRANSPORT_TYPE'];
      let transport: ServeTransport;
      try {
        transport = resolveServeTransport(options.transport, true);
      } catch (e) {
        program.error(e instanceof Error ? e.message : String(e));
        return;
      }

      let listenPort: number | undefined;
      try {
        listenPort = resolveServeApiPort(options.apiPort);
      } catch (e) {
        program.error(e instanceof Error ? e.message : String(e));
        return;
      }

      const source: 'cli' | 'env' | 'default' = options.transport?.trim()
        ? 'cli'
        : envBefore?.trim()
          ? 'env'
          : 'default';

      if (options.apiPort?.trim()) {
        try {
          await writeConfig({ apiUrl: `http://localhost:${listenPort}` });
        } catch (e) {
          program.error(
            e instanceof Error
              ? `kairos serve: could not update CLI config defaultUrl: ${e.message}`
              : String(e)
          );
          return;
        }
      }

      const root = findPackageRoot();
      const args = bootstrapEntry(root);
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        TRANSPORT_TYPE: transport,
        KAIROS_CLI_SERVE: '1',
        KAIROS_CLI_TRANSPORT_SOURCE: source
      };
      if (listenPort !== undefined) {
        env['API_PORT'] = String(listenPort);
      }

      const child = spawn(process.execPath, args, {
        cwd: root,
        env,
        stdio: 'inherit'
      });

      child.on('error', (err) => {
        process.stderr.write(`kairos serve: failed to start server: ${err.message}\n`);
        process.exitCode = 1;
      });

      child.on('exit', (code, signal) => {
        if (signal) {
          process.kill(process.pid, signal);
        }
        process.exit(code ?? 0);
      });
    });
}
