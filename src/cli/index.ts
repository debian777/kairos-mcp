#!/usr/bin/env node
/**
 * KAIROS CLI - Command-line interface for interacting with KAIROS REST API
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import { searchCommand } from './commands/search.js';
import { beginCommand } from './commands/begin.js';
import { mintCommand } from './commands/mint.js';
import { updateCommand } from './commands/update.js';
import { deleteCommand } from './commands/delete.js';
import { rewardCommand } from './commands/attest.js';
import { exportCommand } from './commands/export.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { tokenCommand } from './commands/token.js';
import { getApiUrl } from './config.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

const program = new Command();

program
    .name('kairos')
    .description('CLI tool for interacting with KAIROS REST API')
    .version(version)
    .option('-u, --url <url>', 'KAIROS API base URL', getApiUrl())
    .option('--no-browser', 'do not open browser when auth is required (e.g. in tests or scripts)')
    .hook('preAction', (thisCommand) => {
        // Store the URL and no-browser options for use in commands (subcommands receive their own opts)
        const opts = thisCommand.opts();
        if (opts['url']) {
            process.env['KAIROS_API_URL'] = opts['url'];
        }
        if ((opts as { browser?: boolean }).browser === false) {
            process.env['KAIROS_NO_BROWSER'] = '1';
        }
    });

// Register commands (matching the v10 MCP tool surface)
searchCommand(program);   // activate
beginCommand(program);    // forward
mintCommand(program);     // train
updateCommand(program);   // tune
deleteCommand(program);   // delete
rewardCommand(program);   // reward
exportCommand(program);   // export
loginCommand(program);
logoutCommand(program);
tokenCommand(program);

// Parse arguments
program.parse();

