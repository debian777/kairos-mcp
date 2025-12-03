#!/usr/bin/env node
/**
 * KAIROS CLI - Command-line interface for interacting with KAIROS REST API
 */

import { Command } from 'commander';
import { searchCommand } from './commands/search.js';
import { beginCommand } from './commands/begin.js';
import { nextCommand } from './commands/next.js';
import { mintCommand } from './commands/mint.js';
import { updateCommand } from './commands/update.js';
import { deleteCommand } from './commands/delete.js';
import { attestCommand } from './commands/attest.js';
import { getApiUrl } from './config.js';

const program = new Command();

program
    .name('kairos')
    .description('CLI tool for interacting with KAIROS REST API')
    .version('1.0.0')
    .option('-u, --url <url>', 'KAIROS API base URL', getApiUrl())
    .hook('preAction', (thisCommand) => {
        // Store the URL option globally for use in commands
        const opts = thisCommand.opts();
        if (opts['url']) {
            process.env['KAIROS_API_URL'] = opts['url'];
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

// Parse arguments
program.parse();

