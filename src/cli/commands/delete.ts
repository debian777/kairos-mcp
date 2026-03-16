/**
 * kairos delete command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeJson } from '../output.js';

export function deleteCommand(program: Command): void {
    program
        .command('delete')
        .description('Delete one or more KAIROS memories')
        .argument('<uris...>', 'KAIROS memory URIs (kairos://mem/...)')
        .action(async (uris: string[]) => {
            try {
                const client = new ApiClient(undefined, !program.opts()['noBrowser']);
                const response = await client.delete(uris);
                writeJson(response);
            } catch (error) {
                handleApiError(error, !program.opts()['noBrowser']);
            }
        });
}

