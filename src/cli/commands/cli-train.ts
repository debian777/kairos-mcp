/**
 * CLI `train` command (single file or directory batch).
 */

import { Command } from 'commander';
import { readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { writeError, writeJson } from '../output.js';
import { readMarkdownUploadFromFile } from '../upload-guards.js';
import { createClientFromProgram } from '../client-factory.js';
import { inferArtifactMimeFromName } from '../../tools/artifact-mime.js';

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
    .description('Register a new KAIROS adapter from markdown, or attach a text artifact to an adapter')
    .argument(
      '[path]',
      'Path to a markdown/artifact file, or a directory of .md files (omit when using --source-adapter-uri)'
    )
    .option('--model <model>', 'LLM model ID for attribution (e.g., "gpt-4", "claude-3")')
    .option('--force', 'Force update if an adapter with the same label already exists')
    .option('--recursive', 'When path is a directory, include nested .md files')
    .option(
      '--source-adapter-uri <uri>',
      'Fork from an existing adapter via POST /api/train (requires --model); optional --space for target space'
    )
    .option('--space <space>', 'Target space for train or fork (personal or group display name)')
    .option('--adapter <uri>', 'Artifact mode: parent adapter URI (kairos://adapter/{slug})')
    .option('--artifact-name <name>', 'Artifact mode: artifact filename override (defaults to input basename)')
    .option('--mime <mime>', 'Artifact mode: MIME override (otherwise inferred from filename extension)')
    .option('--relative-path <path>', 'Artifact mode: optional skill-root-relative path for export bundles')
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
          adapter?: string;
          artifactName?: string;
          mime?: string;
          relativePath?: string;
        }
      ) => {
        try {
          const client = createClientFromProgram(program);
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

          const trainOptions: { llmModelId?: string; force?: boolean; space?: string } = {};
          if (options.model) trainOptions.llmModelId = options.model;
          if (options.force) trainOptions.force = options.force;
          if (typeof options.space === 'string' && options.space.trim().length > 0) {
            trainOptions.space = options.space.trim();
          }

          if (st.isDirectory()) {
            if (
              typeof options.adapter === 'string' ||
              typeof options.artifactName === 'string' ||
              typeof options.mime === 'string' ||
              typeof options.relativePath === 'string'
            ) {
              writeError('Artifact flags (--adapter/--artifact-name/--mime/--relative-path) are only supported for single-file train');
              process.exit(1);
              return;
            }
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

          const explicitMime = typeof options.mime === 'string' ? options.mime.trim() : '';
          const inferredFileMime = inferArtifactMimeFromName(basename(abs));
          const hasArtifactFlags =
            typeof options.adapter === 'string' ||
            typeof options.artifactName === 'string' ||
            typeof options.mime === 'string' ||
            typeof options.relativePath === 'string';
          const inferredArtifactByExt =
            explicitMime.length === 0 && inferredFileMime !== null && !abs.toLowerCase().endsWith('.md');
          const isArtifactMode =
            hasArtifactFlags ||
            (explicitMime.length > 0 && explicitMime !== 'text/markdown') ||
            inferredArtifactByExt;

          if (isArtifactMode) {
            const adapterUri = typeof options.adapter === 'string' ? options.adapter.trim() : '';
            if (!adapterUri) {
              writeError('Artifact mode requires --adapter kairos://adapter/{slug}');
              process.exit(1);
              return;
            }
            const model = options.model?.trim();
            if (!model) {
              writeError('--model is required for artifact mode');
              process.exit(1);
              return;
            }
            const artifactName =
              typeof options.artifactName === 'string' && options.artifactName.trim().length > 0
                ? options.artifactName.trim()
                : basename(abs);
            const artifactMime = explicitMime || inferArtifactMimeFromName(artifactName);
            if (!artifactMime) {
              writeError('Cannot infer artifact MIME from filename; pass --mime explicitly');
              process.exit(1);
              return;
            }
            const content = readFileSync(abs, 'utf8');
            const payload: Record<string, unknown> = {
              llm_model_id: model,
              content,
              force_update: Boolean(options.force),
              mime: artifactMime,
              artifact_name: artifactName,
              adapter_uri: adapterUri
            };
            if (typeof options.space === 'string' && options.space.trim().length > 0) {
              payload['space'] = options.space.trim();
            }
            if (typeof options.relativePath === 'string' && options.relativePath.trim().length > 0) {
              payload['relative_path'] = options.relativePath.trim();
            }
            const response = await client.trainJson(payload as {
              llm_model_id: string;
              force_update?: boolean;
              space?: string;
              source_adapter_uri?: string;
              content?: string;
              protocol_version?: string;
              mime?: string;
              artifact_name?: string;
              adapter_uri?: string;
              relative_path?: string;
            });
            writeJson(response);
            return;
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

