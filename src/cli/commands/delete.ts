/**
 * kairos delete command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson } from '../output.js';

export function deleteCommand(program: Command): void {
    program
        .command('delete')
        .description('Delete one or more KAIROS memories')
        .argument('<uris...>', 'KAIROS memory URIs (kairos://mem/...)')
        .action(async (uris: string[]) => {
            try {
                const client = new ApiClient();
                const response = await client.delete(uris);

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

