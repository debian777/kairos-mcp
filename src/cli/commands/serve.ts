/**
 * Run the KAIROS MCP server process (same entry as bootstrap/index).
 * Transport: --transport wins over TRANSPORT_TYPE; default for this command is stdio.
 * Other CLI commands do not read --transport; they are unaffected unless TRANSPORT_TYPE is set in the shell.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';

const VALID = new Set(['stdio', 'http']);

export type ServeTransport = 'stdio' | 'http';

/**
 * Resolve MCP transport for `kairos serve`: CLI --transport > TRANSPORT_TYPE > defaultStdio.
 */
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
    .action((options: { transport?: string }) => {
      const envBefore = process.env['TRANSPORT_TYPE'];
      let transport: ServeTransport;
      try {
        transport = resolveServeTransport(options.transport, true);
      } catch (e) {
        program.error(e instanceof Error ? e.message : String(e));
        return;
      }

      const source: 'cli' | 'env' | 'default' = options.transport?.trim()
        ? 'cli'
        : envBefore?.trim()
          ? 'env'
          : 'default';

      const root = findPackageRoot();
      const args = bootstrapEntry(root);
      const env = {
        ...process.env,
        TRANSPORT_TYPE: transport,
        KAIROS_CLI_SERVE: '1',
        KAIROS_CLI_TRANSPORT_SOURCE: source
      };

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
