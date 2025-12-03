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

                    if (response.error) {
                        writeError(response.error);
                        if (response.message) {
                            writeError(response.message);
                        }
                        process.exit(1);
                        return;
                    }

                    // Store the step
                    allSteps.push(response);

                    // Output based on format
                    if (outputFormat === 'md') {
                        const currentStep = (response as any).current_step;
                        if (currentStep?.content) {
                            writeMarkdown(currentStep.content);
                            // Add separator between steps if following
                            if (options.follow && (response as any).next_step) {
                                writeMarkdown('\n---\n\n');
                            }
                        }
                    } else {
                        writeJson(response);
                    }

                    // Check if we should continue following
                    if (options.follow) {
                        const nextStep = (response as any).next_step;
                        const protocolStatus = (response as any).protocol_status;

                        if (nextStep?.uri && protocolStatus === 'continue') {
                            currentUri = nextStep.uri;
                            // Reset solution for subsequent steps (only applies to first step)
                            solutionResult = undefined;
                        } else {
                            // Chain completed or no next step
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

