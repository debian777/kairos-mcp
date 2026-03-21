/**
 * reward command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeError, writeJson } from '../output.js';

export function rewardCommand(program: Command): void {
    program
        .command('reward')
        .description('Record a reward signal for a KAIROS adapter execution')
        .argument('<uri>', 'KAIROS layer URI (kairos://layer/...)')
        .argument('<outcome>', 'Outcome: success or failure')
        .argument('<feedback>', 'Reward feedback describing the completion or failure')
        .option('--score <number>', 'Normalized reward score in the 0..1 range')
        .option('--rater <rater>', 'Evaluator identifier used for export gating')
        .option('--rubric-version <version>', 'Rubric or policy version used for evaluation')
        .option('--model <model>', 'LLM model ID for attribution (e.g., "gpt-4", "claude-3")')
        .action(async (
            uri: string,
            outcome: string,
            feedback: string,
            options: { score?: string; rater?: string; rubricVersion?: string; model?: string }
        ) => {
            try {
                if (outcome !== 'success' && outcome !== 'failure') {
                    writeError('outcome must be "success" or "failure"');
                    process.exit(1);
                    return;
                }

                const score = options.score !== undefined ? parseFloat(options.score) : undefined;
                if (score !== undefined && isNaN(score)) {
                    writeError('--score must be a number');
                    process.exit(1);
                    return;
                }

                const client = new ApiClient(undefined, !program.opts()['noBrowser']);
                
                const rewardOptions: { score?: number; rater?: string; rubricVersion?: string; llmModelId?: string } = {};
                if (score !== undefined) {
                    rewardOptions.score = score;
                }
                if (options.rater) {
                    rewardOptions.rater = options.rater;
                }
                if (options.rubricVersion) {
                    rewardOptions.rubricVersion = options.rubricVersion;
                }
                if (options.model) {
                    rewardOptions.llmModelId = options.model;
                }
                const response = await client.reward(
                    uri,
                    outcome as 'success' | 'failure',
                    feedback,
                    rewardOptions
                );
                writeJson(response);
            } catch (error) {
                handleApiError(error, !program.opts()['noBrowser']);
            }
        });
}
