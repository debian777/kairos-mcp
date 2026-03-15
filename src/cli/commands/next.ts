/**
 * kairos next command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson, writeMarkdown } from '../output.js';

export function nextCommand(program: Command): void {
    program
        .command('next')
        .description('Get the next step in a KAIROS protocol chain')
        .argument('<uri>', 'KAIROS memory URI (kairos://mem/...)')
        .option('--solution <json>', 'Solution result as JSON string (for steps requiring challenge)')
        .option('--follow', 'Follow all URLs in the chain until completion')
        .option('--output <format>', 'Output format: md (markdown content only) or json (full response)', 'md')
        .action(async (uri: string, options: { solution?: string; follow?: boolean; output?: string }) => {
            try {
                const outputFormat = options.output || 'md';
                if (outputFormat !== 'md' && outputFormat !== 'json') {
                    writeError('--output must be "md" or "json"');
                    process.exit(1);
                    return;
                }

                const client = new ApiClient();
                let solutionResult;
                if (options.solution) {
                    try {
                        solutionResult = JSON.parse(options.solution);
                    } catch (_e) {
                        writeError('Invalid JSON in --solution option');
                        process.exit(1);
                        return;
                    }
                }

                let currentUri = uri;
                const allSteps: any[] = [];

                do {
                    const response = await client.next(currentUri, solutionResult);
                    allSteps.push(response);

                    if (outputFormat === 'md') {
                        const currentStep = response.current_step;
                        if (currentStep?.content) {
                            writeMarkdown(currentStep.content);
                            if (options.follow && response.next_action?.includes('kairos_next')) {
                                writeMarkdown('\n---\n\n');
                            }
                        }
                    } else {
                        writeJson(response);
                    }

                    if (options.follow) {
                        const nextAction = response.next_action;
                        // Extract URI from next_action if it mentions kairos_next
                        const nextUriMatch = typeof nextAction === 'string' ? nextAction.match(/kairos_next\s+with\s+(kairos:\/\/mem\/[0-9a-f-]{36})/i) : null;
                        if (nextUriMatch?.[1]) {
                            currentUri = nextUriMatch[1];
                            solutionResult = undefined;
                        } else {
                            // Chain completed or next_action says kairos_attest
                            break;
                        }
                    } else {
                        // Not following, just output the single step
                        break;
                    }
                } while (options.follow);

            } catch (error) {
                writeError(error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
}

