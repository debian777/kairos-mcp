/**
 * kairos mint command
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson } from '../output.js';

export function mintCommand(program: Command): void {
    program
        .command('mint')
        .description('Store a new markdown document in KAIROS')
        .argument('<file>', 'Path to markdown file')
        .option('--model <model>', 'LLM model ID')
        .option('--force', 'Force update if chain already exists')
        .action(async (file: string, options: { model?: string; force?: boolean }) => {
            try {
                const markdown = readFileSync(file, 'utf-8');
                const client = new ApiClient();
                const mintOptions: { llmModelId?: string; force?: boolean } = {};
                if (options.model) {
                    mintOptions.llmModelId = options.model;
                }
                if (options.force) {
                    mintOptions.force = options.force;
                }
                const response = await client.mint(markdown, mintOptions);

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
                    writeError(`File not found: ${file}`);
                } else {
                    writeError(error instanceof Error ? error.message : String(error));
                }
                process.exit(1);
            }
        });
}

