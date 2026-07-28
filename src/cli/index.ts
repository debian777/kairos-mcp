#!/usr/bin/env node
/**
 * KAIROS CLI - Command-line interface for interacting with KAIROS REST API
 */

import { createProgram } from './program.js';

// Parse arguments (async for commands that perform I/O before spawn, e.g. `serve`)
await createProgram().parseAsync(process.argv);

