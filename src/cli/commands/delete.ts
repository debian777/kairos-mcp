/**
 * delete command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeJson } from '../output.js';
import { DELETE_COMMAND_DESCRIPTION, DELETE_COMMAND_URI_ARGUMENT_DESCRIPTION } from './delete-metadata.js';

export function deleteCommand(program: Command): void {
    program
        .command('delete')
        .description(DELETE_COMMAND_DESCRIPTION)
        .argument('<uris...>', DELETE_COMMAND_URI_ARGUMENT_DESCRIPTION)
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

