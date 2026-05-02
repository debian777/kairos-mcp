import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';
import type { ExportInput } from '../../tools/export_schema.js';
import { writeJson, writeMarkdown, writeStderr } from '../output.js';

function buildExportInput(uri: string, format: string | undefined): ExportInput {
    const f = (format ?? 'markdown').trim();
    if (f === 'markdown') {
        return { uri, format: 'markdown', include_reward: true };
    }
    return {
        uri,
        format: f as ExportInput['format'],
        include_reward: true
    };
}

export function exportCommand(program: Command): void {
    program
        .command('export')
        .description('Export a KAIROS adapter (flat markdown, skill zip/tree, training JSONL, or source)')
        .argument('<uri>', 'KAIROS adapter or layer URI')
        .option(
            '--format <format>',
            'markdown (flat single-file adapter Markdown), skill_zip, skill_tree, source, trace_jsonl, reward_jsonl, sft_jsonl, preference_jsonl',
            'markdown'
        )
        .option('--output <mode>', 'text to print raw exported content, json to print full response', 'text')
        .option(
            '--zip-out <file>',
            'when format is skill_zip and --output text, write decoded ZIP bytes to this path'
        )
        .action(
            async (
                uri: string,
                options: { format?: string; output?: string; zipOut?: string }
            ) => {
                try {
                    const client = new ApiClient(getResolvedApiBaseFromProgram(program));
                    const response = await client.export(buildExportInput(uri, options.format));
                    if (options.output === 'json') {
                        writeJson(response);
                        return;
                    }
                    if (
                        response.format === 'skill_zip' &&
                        response.content_encoding === 'base64' &&
                        options.zipOut
                    ) {
                        writeFileSync(options.zipOut, Buffer.from(response.content, 'base64'));
                        return;
                    }
                    if (response.format === 'skill_zip' && response.content_encoding === 'base64') {
                        writeStderr(
                            'skill_zip returns binary data: use --zip-out <path> to write the ZIP, or --output json.'
                        );
                        process.exitCode = 1;
                        return;
                    }
                    writeMarkdown(response.content);
                } catch (error) {
                    handleApiError(error, !isBrowserDisabled());
                }
            }
        );
}

