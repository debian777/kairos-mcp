#!/usr/bin/env node
/**
 * KAIROS CLI - Command-line interface for interacting with KAIROS REST API
 */

import { createProgram } from './program.js';

// Parse arguments
createProgram().parse();

