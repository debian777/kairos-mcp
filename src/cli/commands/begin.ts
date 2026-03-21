/**
 * kairos begin command - Read step 1 (no proof-of-work required)
 */

import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { handleApiError } from '../auth-error.js';
import { writeJson } from '../output.js';

export function beginCommand(program: Command): void {
    program
        .command('begin')
        .description('Read the first step of a KAIROS protocol chain (no proof-of-work required)')
        .argument('[uri]', 'KAIROS memory URI (kairos://mem/...) — omit if using --key')
        .option('--key <slug>', 'Start by protocol slug (exact match; deterministic routing)')
        .action(async (uri: string | undefined, options: { key?: string }) => {
            try {
                const client = new ApiClient(undefined, !program.opts()['noBrowser']);
                const k = options.key?.trim();
                const u = uri?.trim();
                if (u && k) {
                    const response = await client.begin({ uri: u });
                    writeJson(response);
                    return;
                }
                if (u) {
                    const response = await client.begin({ uri: u });
                    writeJson(response);
                    return;
                }
                if (k) {
                    const response = await client.begin({ key: k });
                    writeJson(response);
                    return;
                }
                program.error('Provide a memory URI or --key <slug>');
            } catch (error) {
                handleApiError(error, !program.opts()['noBrowser']);
            }
        });
}

