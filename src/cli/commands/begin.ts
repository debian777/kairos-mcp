/**
 * forward command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeJson } from '../output.js';

export function forwardCommand(program: Command): void {
    program
        .command('forward')
        .description('Run the first or next KAIROS adapter layer')
        .argument('<uri>', 'KAIROS adapter or layer URI')
        .option('--solution <json>', 'Forward solution as JSON string')
        .action(async (uri: string, options: { solution?: string }) => {
            try {
                const client = new ApiClient(undefined, !program.opts()['noBrowser']);
                const solution = options.solution ? JSON.parse(options.solution) : undefined;
                const response = await client.forward(uri, solution);
                writeJson(response);
            } catch (error) {
                handleApiError(error, !program.opts()['noBrowser']);
            }
        });
}

