/**
 * kairos search command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeJson } from '../output.js';

export function searchCommand(program: Command): void {
    program
        .command('search')
        .description('Search for KAIROS protocols by query')
        .argument('<query...>', 'Search query (multiple words allowed)')
        .action(async (query: string[]) => {
            try {
                const client = new ApiClient(undefined, !program.opts()['noBrowser']);
                const response = await client.search(query.join(' '));
                writeJson(response);
            } catch (error) {
                handleApiError(error, !program.opts()['noBrowser']);
            }
        });
}

