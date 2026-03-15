/**
 * kairos search command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson } from '../output.js';

export function searchCommand(program: Command): void {
    program
        .command('search')
        .description('Search for KAIROS protocols by query')
        .argument('<query...>', 'Search query (multiple words allowed)')
        .action(async (query: string[]) => {
            try {
                const client = new ApiClient();
                const response = await client.search(query.join(' '));
                writeJson(response);
            } catch (error) {
                writeError(error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
}

