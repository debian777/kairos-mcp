/**
 * kairos begin command - Read step 1 (no proof-of-work required)
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeError, writeJson } from '../output.js';

export function beginCommand(program: Command): void {
    program
        .command('begin')
        .description('Read the first step of a KAIROS protocol chain (no proof-of-work required)')
        .argument('<uri>', 'KAIROS memory URI (kairos://mem/...)')
        .action(async (uri: string) => {
            try {
                const client = new ApiClient();
                const response = await client.begin(uri);

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
                handleApiError(error, program.opts()['open']);
            }
        });
}

