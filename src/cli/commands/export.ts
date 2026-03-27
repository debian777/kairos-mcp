import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';
import { writeJson, writeMarkdown } from '../output.js';

export function exportCommand(program: Command): void {
    program
        .command('export')
        .description('Export a KAIROS adapter as markdown or training JSONL')
        .argument('<uri>', 'KAIROS adapter or layer URI')
        .option(
            '--format <format>',
            'markdown, trace_jsonl, reward_jsonl, sft_jsonl, or preference_jsonl',
            'markdown'
        )
        .option('--output <mode>', 'text to print raw exported content, json to print full response', 'text')
        .action(async (uri: string, options: { format?: string; output?: string }) => {
            try {
                const client = new ApiClient(getResolvedApiBaseFromProgram(program));
                const response = await client.export(
                    uri,
                    (
                        options.format as
                            | 'markdown'
                            | 'trace_jsonl'
                            | 'reward_jsonl'
                            | 'sft_jsonl'
                            | 'preference_jsonl'
                    ) ?? 'markdown'
                );
                if (options.output === 'json') {
                    writeJson(response);
                } else {
                    writeMarkdown(response.content);
                }
            } catch (error) {
                handleApiError(error, !isBrowserDisabled());
            }
        });
}

