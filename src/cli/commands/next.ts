/**
 * kairos next command
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { writeError, writeJson } from '../output.js';

export function nextCommand(program: Command): void {
    program
        .command('next')
        .description('Get the next step in a KAIROS protocol chain')
        .argument('<uri>', 'KAIROS memory URI (kairos://mem/...)')
        .option('--proof-of-work <json>', 'Proof of work result as JSON string')
        .action(async (uri: string, options: { proofOfWork?: string }) => {
            try {
                const client = new ApiClient();
                let proofOfWorkResult;
                if (options.proofOfWork) {
                    try {
                        proofOfWorkResult = JSON.parse(options.proofOfWork);
                    } catch (_e) {
                        writeError('Invalid JSON in --proof-of-work option');
                        process.exit(1);
                        return;
                    }
                }
                const response = await client.next(uri, proofOfWorkResult);

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

