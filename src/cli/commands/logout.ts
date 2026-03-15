/**
 * kairos logout — clear stored Bearer token from config.
 */

import { Command } from 'commander';
import { writeConfig } from '../config-file.js';
import { writeStdout } from '../output.js';

export function logoutCommand(program: Command): void {
    program
        .command('logout')
        .description('Clear the stored Bearer token from config file')
        .action(() => {
            writeConfig({ bearerToken: null });
            writeStdout('Token cleared from config.');
        });
}
