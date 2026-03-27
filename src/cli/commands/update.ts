/**
 * tune command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';
import { writeError, writeJson } from '../output.js';
import { readMarkdownUploadFromFile, type SafeMarkdownUpload } from '../upload-guards.js';

export function updateCommand(program: Command): void {
    program
        .command('tune')
        .description('Update one or more KAIROS adapter layers')
        .argument('<uris...>', 'KAIROS adapter or layer URIs')
        .option('--file <file>', 'Path to markdown file to apply to all specified URIs')
        .option('--files <files...>', 'Paths to markdown files, one per URI (must match number of URIs)')
        .option('--updates <json>', 'Updates object as JSON string (alternative to --file/--files)')
        .option('--allow-sensitive-upload', 'Allow uploads that contain token-like or private-key-like text')
        .action(async (
            uris: string[],
            options: { file?: string; files?: string[]; updates?: string; allowSensitiveUpload?: boolean }
        ) => {
            try {
                const client = new ApiClient(getResolvedApiBaseFromProgram(program));
                let markdownDoc: SafeMarkdownUpload[] | undefined;
                let updates: Record<string, any> | undefined;

                if (options.files) {
                    // Multiple files, one per URI
                    if (options.files.length !== uris.length) {
                        writeError('Number of files must match number of URIs');
                        process.exit(1);
                        return;
                    }
                    markdownDoc = options.files.map((file) =>
                        readMarkdownUploadFromFile(file, 'tune', Boolean(options.allowSensitiveUpload))
                    );
                } else if (options.file) {
                    // Single file for all URIs
                    const content = readMarkdownUploadFromFile(
                        options.file,
                        'tune',
                        Boolean(options.allowSensitiveUpload)
                    );
                    markdownDoc = uris.map(() => content);
                } else if (options.updates) {
                    try {
                        updates = JSON.parse(options.updates);
                    } catch (_e) {
                        writeError('Invalid JSON in --updates option');
                        process.exit(1);
                        return;
                    }
                } else {
                    writeError('Must provide either --file or --updates');
                    process.exit(1);
                    return;
                }

                const response = await client.tune(uris, markdownDoc, updates);
                writeJson(response);
            } catch (error) {
                if (error instanceof Error && error.message.includes('ENOENT')) {
                    writeError('File not found');
                    process.exit(1);
                }
                handleApiError(error, !isBrowserDisabled());
            }
        });
}

