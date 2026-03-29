/**
 * CLI `train` command (single file or directory batch).
 */

import { Command } from 'commander';
import { readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';
import { writeError, writeJson } from '../output.js';
import { readMarkdownUploadFromFile } from '../upload-guards.js';

/** Directory batch skips `README.md` (human docs); single-file `train path/to/README.md` still works. */
function isReadmeMarkdownFileName(name: string): boolean {
  return /^readme\.md$/i.test(name);
}

function listMarkdownFiles(dir: string, recursive: boolean): string[] {
  const base = resolve(dir);
  const out: string[] = [];
  if (recursive) {
    const walk = (current: string): void => {
      for (const ent of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (ent.isFile() && ent.name.endsWith('.md') && !isReadmeMarkdownFileName(ent.name)) {
          out.push(full);
        }
      }
    };
    walk(base);
  } else {
    for (const ent of readdirSync(base, { withFileTypes: true })) {
      const full = join(base, ent.name);
      if (ent.isFile() && ent.name.endsWith('.md') && !isReadmeMarkdownFileName(ent.name)) {
        out.push(full);
      }
    }
  }
  return out.sort((a, b) => relative(base, a).localeCompare(relative(base, b)));
}

export function trainCliCommand(program: Command): void {
  program
    .command('train')
    .description('Register a new KAIROS adapter from markdown (file or directory of .md files)')
    .argument(
      '[path]',
      'Path to a markdown file or a directory of .md files (omit when using --source-adapter-uri)'
    )
    .option('--model <model>', 'LLM model ID for attribution (e.g., "gpt-4", "claude-3")')
    .option('--force', 'Force update if an adapter with the same label already exists')
    .option('--recursive', 'When path is a directory, include nested .md files')
    .option(
      '--source-adapter-uri <uri>',
      'Fork from an existing adapter via POST /api/train (requires --model); optional --space for target space'
    )
    .option('--space <space>', 'Target space for train or fork (personal or group display name)')
    .option('--allow-sensitive-upload', 'Allow uploads that contain token-like or private-key-like text')
    .action(
      async (
        target: string | undefined,
        options: {
          model?: string;
          force?: boolean;
          recursive?: boolean;
          allowSensitiveUpload?: boolean;
          sourceAdapterUri?: string;
          space?: string;
        }
      ) => {
        try {
          const client = new ApiClient(getResolvedApiBaseFromProgram(program));
          const src = typeof options.sourceAdapterUri === 'string' ? options.sourceAdapterUri.trim() : '';
          if (src.length > 0) {
            if (target) {
              writeError('Do not pass a path when using --source-adapter-uri');
              process.exit(1);
              return;
            }
            const model = options.model?.trim();
            if (!model) {
              writeError('--model is required when using --source-adapter-uri');
              process.exit(1);
              return;
            }
            const spaceOpt = typeof options.space === 'string' ? options.space.trim() : '';
            const response = await client.trainJson({
              llm_model_id: model,
              force_update: Boolean(options.force),
              source_adapter_uri: src,
              ...(spaceOpt.length > 0 ? { space: spaceOpt } : {})
            });
            writeJson(response);
            return;
          }

          if (!target) {
            writeError('Missing path: provide a markdown file/directory or use --source-adapter-uri');
            process.exit(1);
            return;
          }

          const abs = resolve(target);
          const st = statSync(abs, { throwIfNoEntry: false });
          if (!st) {
            writeError(`File not found: ${target}`);
            process.exit(1);
          }

          const trainOptions: { llmModelId?: string; force?: boolean } = {};
          if (options.model) trainOptions.llmModelId = options.model;
          if (options.force) trainOptions.force = options.force;

          if (st.isDirectory()) {
            const files = listMarkdownFiles(abs, Boolean(options.recursive));
            if (files.length === 0) {
              writeError('No .md files found in directory');
              process.exit(1);
            }
            const results: Array<{
              path: string;
              ok: boolean;
              status?: string;
              items?: unknown[];
              error?: string;
            }> = [];
            for (const fp of files) {
              const rel = relative(abs, fp).replace(/\\/g, '/');
              try {
                const markdown = readMarkdownUploadFromFile(fp, 'train', Boolean(options.allowSensitiveUpload));
                const response = await client.train(markdown, trainOptions);
                results.push({
                  path: rel,
                  ok: true,
                  status: response.status,
                  items: response.items
                });
              } catch (e) {
                results.push({
                  path: rel,
                  ok: false,
                  error: e instanceof Error ? e.message : String(e)
                });
              }
            }
            writeJson({ batch: true, root: abs, results });
            return;
          }

          if (!st.isFile()) {
            writeError(`Not a regular file: ${target}`);
            process.exit(1);
          }

          const markdown = readMarkdownUploadFromFile(abs, 'train', Boolean(options.allowSensitiveUpload));
          const response = await client.train(markdown, trainOptions);
          writeJson(response);
        } catch (error) {
          const err = error as { code?: string; message?: string };
          if (err.code === 'ENOTREG') {
            writeError(`Not a regular file: ${target}`);
            process.exit(1);
          }
          if (error instanceof Error && error.message.includes('ENOENT')) {
            writeError(`File not found: ${target}`);
            process.exit(1);
          }
          handleApiError(error, !isBrowserDisabled());
        }
      }
    );
}
