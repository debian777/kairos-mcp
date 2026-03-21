/**
 * train command
 */

import { Command } from 'commander';
import { closeSync, fstatSync, openSync, readFileSync } from 'fs';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeError, writeJson } from '../output.js';

/**
 * Open path read-only, require regular file, read UTF-8 from the same fd
 * (avoids path-based stat-then-read races; CodeQL js/file-system-race).
 */
function readRegularFileUtf8(absPath: string): string {
  const fd = openSync(absPath, 'r');
  try {
    if (!fstatSync(fd).isFile()) {
      throw Object.assign(new Error('Path is not a regular file'), { code: 'ENOTREG' });
    }
    return readFileSync(fd, 'utf-8') as string;
  } finally {
    closeSync(fd);
  }
}

export function mintCommand(program: Command): void {
  program
    .command('train')
    .description('Register a new KAIROS adapter from markdown')
    .argument('<file>', 'Path to markdown file')
    .option('--model <model>', 'LLM model ID for attribution (e.g., "gpt-4", "claude-3")')
    .option('--force', 'Force update if a memory chain with the same label already exists')
    .action(async (file: string, options: { model?: string; force?: boolean }) => {
      try {
        const markdown = readRegularFileUtf8(file);
        const client = new ApiClient(undefined, !program.opts()['noBrowser']);
        const trainOptions: { llmModelId?: string; force?: boolean } = {};
        if (options.model) {
          trainOptions.llmModelId = options.model;
        }
        if (options.force) {
          trainOptions.force = options.force;
        }
        const response = await client.train(markdown, trainOptions);
        writeJson(response);
      } catch (error) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'ENOTREG') {
          writeError(`Not a regular file: ${file}`);
          process.exit(1);
        }
        if (error instanceof Error && error.message.includes('ENOENT')) {
          writeError(`File not found: ${file}`);
          process.exit(1);
        }
        handleApiError(error, !program.opts()['noBrowser']);
      }
    });
}
