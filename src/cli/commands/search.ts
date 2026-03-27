/**
 * activate command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError, isBrowserDisabled } from '../auth-error.js';
import { getResolvedApiBaseFromProgram } from '../resolve-api-base.js';
import { writeJson } from '../output.js';

export function activateCommand(program: Command): void {
    program
        .command('activate')
        .description('Activate the best matching KAIROS adapter for a query')
        .argument('<query...>', 'Search query (multiple words allowed)')
        .action(async (query: string[]) => {
            try {
                const client = new ApiClient(getResolvedApiBaseFromProgram(program));
                const response = await client.activate(query.join(' '));
                writeJson(response);
            } catch (error) {
                handleApiError(error, !isBrowserDisabled());
            }
        });
}

