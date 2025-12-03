/**
 * kairos attest command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson } from '../output.js';

export function attestCommand(program: Command): void {
    program
        .command('attest')
        .description('Attest completion or failure of a KAIROS protocol step')
        .argument('<uri>', 'KAIROS memory URI (kairos://mem/...)')
        .argument('<outcome>', 'Outcome: success or failure')
        .argument('<message>', 'Attestation message describing the completion or failure')
        .option('--quality-bonus <number>', 'Additional quality bonus to apply (default: 0)', '0')
        .option('--model <model>', 'LLM model ID for attribution (e.g., "gpt-4", "claude-3")')
        .option('--final-solution <json>', 'Final solution result as JSON string (required). If not provided, defaults to comment-type solution.')
        .action(async (
            uri: string,
            outcome: string,
            message: string,
            options: { qualityBonus?: string; model?: string; finalSolution?: string }
        ) => {
            try {
                if (outcome !== 'success' && outcome !== 'failure') {
                    writeError('outcome must be "success" or "failure"');
                    process.exit(1);
                    return;
                }

                const qualityBonus = options.qualityBonus ? parseFloat(options.qualityBonus) : 0;
                if (isNaN(qualityBonus)) {
                    writeError('--quality-bonus must be a number');
                    process.exit(1);
                    return;
                }

                const client = new ApiClient();
                
                // Parse final solution or default to comment type
                let finalSolution: any;
                if (options.finalSolution) {
                    try {
                        finalSolution = JSON.parse(options.finalSolution);
                    } catch (_e) {
                        writeError('Invalid JSON in --final-solution option');
                        process.exit(1);
                        return;
                    }
                } else {
                    // Default to comment-type solution if not provided
                    finalSolution = {
                        type: 'comment',
                        comment: {
                            text: message.length >= 10 ? message : `${message} - Attestation completed`
                        }
                    };
                }

                const attestOptions: { qualityBonus?: number; llmModelId?: string } = {
                    qualityBonus,
                };
                if (options.model) {
                    attestOptions.llmModelId = options.model;
                }
                const response = await client.attest(
                    uri,
                    outcome as 'success' | 'failure',
                    message,
                    finalSolution,
                    attestOptions
                );

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
                writeError(error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
}

