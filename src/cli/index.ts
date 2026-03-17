#!/usr/bin/env node
/**
 * KAIROS CLI - Command-line interface for interacting with KAIROS REST API
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import { searchCommand } from './commands/search.js';
import { beginCommand } from './commands/begin.js';
import { nextCommand } from './commands/next.js';
import { mintCommand } from './commands/mint.js';
import { updateCommand } from './commands/update.js';
import { deleteCommand } from './commands/delete.js';
import { attestCommand } from './commands/attest.js';
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

// Register commands (matching MCP tool names 1:1)
searchCommand(program);  // kairos_search
beginCommand(program);   // kairos_begin (step 1)
nextCommand(program);    // kairos_next (steps 2+)
mintCommand(program);     // kairos_mint
updateCommand(program);   // kairos_update
deleteCommand(program);  // kairos_delete
attestCommand(program);   // kairos_attest
loginCommand(program);
logoutCommand(program);
tokenCommand(program);

// Parse arguments
program.parse();

