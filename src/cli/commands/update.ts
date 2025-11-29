/**
 * kairos update command
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson } from '../output.js';

export function updateCommand(program: Command): void {
    program
        .command('update')
        .description('Update one or more KAIROS memories')
        .argument('<uris...>', 'KAIROS memory URIs (kairos://mem/...)')
        .option('--file <file>', 'Path to markdown file to apply to all specified URIs')
        .option('--files <files...>', 'Paths to markdown files, one per URI (must match number of URIs)')
        .option('--updates <json>', 'Updates object as JSON string (alternative to --file/--files)')
        .action(async (uris: string[], options: { file?: string; files?: string[]; updates?: string }) => {
            try {
                const client = new ApiClient();
                let markdownDoc: string[] | undefined;
                let updates: Record<string, any> | undefined;

                if (options.files) {
                    // Multiple files, one per URI
                    if (options.files.length !== uris.length) {
                        writeError('Number of files must match number of URIs');
                        process.exit(1);
                        return;
                    }
                    markdownDoc = options.files.map(file => readFileSync(file, 'utf-8'));
                } else if (options.file) {
                    // Single file for all URIs
                    const content = readFileSync(options.file, 'utf-8');
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

                const response = await client.update(uris, markdownDoc, updates);

                if (response.error) {
                    writeError(response.error);
                    if (response.message) {
                        writeError(response.message);
                    }
                    process.exit(1);
                    return;
                }

                // Pretty print the response
                writeJson(response);
            } catch (error) {
                if (error instanceof Error && error.message.includes('ENOENT')) {
                    writeError('File not found');
                } else {
                    writeError(error instanceof Error ? error.message : String(error));
                }
                process.exit(1);
            }
        });
}

