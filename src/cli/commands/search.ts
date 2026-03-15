/**
 * kairos search command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeError, writeJson } from '../output.js';

export function searchCommand(program: Command): void {
    program
        .command('search')
        .description('Search for KAIROS protocols by query')
        .argument('<query...>', 'Search query (multiple words allowed)')
        .action(async (query: string[]) => {
            try {
                const client = new ApiClient(undefined, !program.opts()['noBrowser']);
                const response = await client.search(query.join(' '));

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
                handleApiError(error, !program.opts()['noBrowser']);
            }
        });
}

