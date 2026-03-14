/**
 * kairos logout — clear stored Bearer token from config.
 */

import { Command } from 'commander';
import { writeConfig } from '../config-file.js';
import { writeStdout } from '../output.js';

export function logoutCommand(program: Command): void {
    program
        .command('logout')
        .description('Clear the stored Bearer token (config file only; env KAIROS_BEARER_TOKEN is unchanged)')
        .action(() => {
            writeConfig({ KAIROS_BEARER_TOKEN: null });
            writeStdout('Token cleared from config.');
        });
}
