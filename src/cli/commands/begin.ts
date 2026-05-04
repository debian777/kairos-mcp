/**
 * forward command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';
import { writeJson } from '../output.js';
import { formatNextCallBlock } from '../format-next-call.js';

export function forwardCommand(program: Command): void {
    program
        .command('forward')
        .description('Run the first or next KAIROS adapter layer')
        .argument('<uri>', 'KAIROS adapter or layer URI')
        .option('--solution <json>', 'Forward solution as JSON string')
        .action(async (uri: string, options: { solution?: string }) => {
            try {
                const client = new ApiClient(getResolvedApiBaseFromProgram(program));
                const solution = options.solution ? JSON.parse(options.solution) : undefined;
                const response = await client.forward(uri, solution);
                const nextCall = formatNextCallBlock(response);
                writeJson(nextCall ? { ...response, cli_next_call: nextCall } : response);
            } catch (error) {
                handleApiError(error, !isBrowserDisabled());
            }
        });
}

