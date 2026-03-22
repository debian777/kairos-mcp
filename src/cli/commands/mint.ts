/**
 * kairos mint command
 */

import { Command } from 'commander';
import { closeSync, fstatSync, openSync, readFileSync, readdirSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeError, writeJson } from '../output.js';
import type { MintOutput } from '../../tools/kairos_mint_schema.js';

function isMdFileName(name: string): boolean {
    return name.endsWith('.md');
}

/** Directory batches skip README.md (human docs in bundles); single-file mint is unchanged. */
function isBatchSkippedMd(relOrName: string): boolean {
    return basename(relOrName.replace(/\\/g, '/')) === 'README.md';
}

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

/** Absolute paths to `.md` names under root, sorted lexicographically (presence as file verified at read time). */
function collectMdFiles(absRoot: string, recursive: boolean): string[] {
    if (!recursive) {
        const dirents = readdirSync(absRoot, { withFileTypes: true });
        const paths: string[] = [];
        for (const d of dirents) {
            if (!isMdFileName(d.name)) continue;
            if (isBatchSkippedMd(d.name)) continue;
            paths.push(join(absRoot, d.name));
        }
        return paths.sort((a, b) => a.localeCompare(b));
    }

    const relEntries = readdirSync(absRoot, { recursive: true }) as string[];
    const paths: string[] = [];
    for (const rel of relEntries) {
        if (!rel || !isMdFileName(rel)) continue;
        if (isBatchSkippedMd(rel)) continue;
        paths.push(join(absRoot, rel));
    }
    return paths.sort((a, b) => a.localeCompare(b));
}

type BatchEntry =
    | { path: string; ok: true; status: 'stored'; items: MintOutput['items'] }
    | { path: string; ok: false; error: string };

function jsonPathForResult(absRoot: string, filePath: string): string {
    return relative(absRoot, filePath).split('\\').join('/');
}

export function mintCommand(program: Command): void {
    program
        .command('mint')
        .description('Store a new markdown document in KAIROS (file, or directory of .md files)')
        .argument('<path>', 'Path to a markdown file or a directory of .md files')
        .option('--model <model>', 'LLM model ID for attribution (e.g., "gpt-4", "claude-3")')
        .option('--force', 'Force update if a memory chain with the same label already exists')
        .option('-r, --recursive', 'When path is a directory, include .md files in subdirectories')
        .option('--fail-fast', 'Stop on first mint error (default: mint all files, exit 1 if any failed)')
        .action(
            async (
                inputPath: string,
                options: { model?: string; force?: boolean; recursive?: boolean; failFast?: boolean }
            ) => {
                const openBrowser = !program.opts()['noBrowser'];
                try {
                    let fd: number;
                    try {
                        fd = openSync(inputPath, 'r');
                    } catch (e) {
                        if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
                            writeError(`Path not found: ${inputPath}`);
                            process.exit(1);
                        }
                        throw e;
                    }

                    let fdClosed = false;
                    const closeFd = (): void => {
                        if (!fdClosed) {
                            closeSync(fd);
                            fdClosed = true;
                        }
                    };

                    const mintOptions: { llmModelId?: string; force?: boolean } = {};
                    if (options.model) {
                        mintOptions.llmModelId = options.model;
                    }
                    if (options.force) {
                        mintOptions.force = options.force;
                    }

                    const client = new ApiClient(undefined, openBrowser);

                    try {
                        const fst = fstatSync(fd);
                        if (fst.isFile()) {
                            const markdown = readFileSync(fd, 'utf-8');
                            closeFd();
                            const response = await client.mint(markdown, mintOptions);
                            writeJson(response);
                            return;
                        }
                        if (!fst.isDirectory()) {
                            closeFd();
                            writeError(`Not a file or directory: ${inputPath}`);
                            process.exit(1);
                        }
                        closeFd();
                    } catch (err) {
                        closeFd();
                        throw err;
                    }

                    const absRoot = resolve(inputPath);
                    const mdFiles = collectMdFiles(absRoot, Boolean(options.recursive));
                    if (mdFiles.length === 0) {
                        writeError(`No .md files in ${inputPath}`);
                        process.exit(1);
                    }

                    const results: BatchEntry[] = [];
                    let anyFailed = false;
                    const failFast = Boolean(options.failFast);

                    for (const filePath of mdFiles) {
                        const relPath = jsonPathForResult(absRoot, filePath);
                        try {
                            const markdown = readRegularFileUtf8(filePath);
                            const response = await client.mint(markdown, mintOptions);
                            results.push({
                                path: relPath,
                                ok: true,
                                status: response.status,
                                items: response.items
                            });
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            results.push({ path: relPath, ok: false, error: message });
                            anyFailed = true;
                            if (failFast) {
                                break;
                            }
                        }
                    }

                    writeJson({
                        batch: true,
                        root: absRoot,
                        results
                    });

                    if (anyFailed) {
                        process.exit(1);
                    }
                } catch (error) {
                    if (error instanceof Error && error.message.includes('ENOENT')) {
                        writeError(`File not found: ${inputPath}`);
                        process.exit(1);
                    }
                    handleApiError(error, openBrowser);
                }
            }
        );
}
