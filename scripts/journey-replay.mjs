#!/usr/bin/env node
/**
 * Journey replay script.
 *
 * Replays an exported journey JSON against a running KAIROS MCP server.
 * Sends each tool call in sequence and runs consistency checks.
 *
 * Usage:
 *   node scripts/journey-replay.mjs --journey ./journeys/corr-abc.json --server http://localhost:3300
 *
 * Options:
 *   --journey <path>     Path to the journey JSON file (required)
 *   --server <url>       Base URL of the KAIROS server (required)
 *   --bearer <token>     Bearer token for auth (or set JOURNEY_BEARER_TOKEN env)
 *   --strict             Fail on any drift (CI mode, exit code 1)
 *   --redact-tenant <id> Send a different tenant_id (test multi-tenancy)
 *   --dry-run            Validate journey file without sending requests
 *   --help               Show this help message
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ── CLI argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name, required = false) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  if (!val || val.startsWith('--')) {
    console.error(`Error: --${name} requires a value`);
    process.exit(1);
  }
  return val;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

if (hasFlag('help')) {
  console.log(`
Journey replay: replay exported journey against a KAIROS server

Usage:
  node scripts/journey-replay.mjs --journey ./journeys/corr-abc.json --server http://localhost:3300

Options:
  --journey <path>     Path to the journey JSON file (required)
  --server <url>       Base URL of the KAIROS server (required)
  --bearer <token>     Bearer token for auth (or set JOURNEY_BEARER_TOKEN env)
  --strict             Fail on any drift (CI mode, exit code 1)
  --redact-tenant <id> Send a different tenant_id (test multi-tenancy)
  --dry-run            Validate journey file without sending requests
  --help               Show this help message
`);
  process.exit(0);
}

const journeyPath = resolve(getArg('journey') || '');
const serverUrl = (getArg('server') || '').replace(/\/$/, '');
const bearerToken = getArg('bearer') || process.env.JOURNEY_BEARER_TOKEN || '';
const strictMode = hasFlag('strict');
const dryRun = hasFlag('dry-run');

if (!journeyPath || !getArg('journey')) {
  console.error('Error: --journey is required');
  process.exit(1);
}
if (!serverUrl && !dryRun) {
  console.error('Error: --server is required (or use --dry-run)');
  process.exit(1);
}

// ── MCP JSON-RPC client ──────────────────────────────────────────────────────

let jsonRpcId = 0;

async function mcpToolCall(toolName, toolArgs) {
  const body = {
    jsonrpc: '2.0',
    id: ++jsonRpcId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: toolArgs
    }
  };

  const headers = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  const res = await fetch(`${serverUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  const rpcResponse = await res.json();
  if (rpcResponse.error) {
    return { isError: true, error: rpcResponse.error };
  }
  return rpcResponse.result || {};
}

async function mcpToolsList() {
  const body = {
    jsonrpc: '2.0',
    id: ++jsonRpcId,
    method: 'tools/list',
    params: {}
  };

  const headers = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  const res = await fetch(`${serverUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) return [];
  const rpcResponse = await res.json();
  return rpcResponse.result?.tools || [];
}

// ── Consistency checks ───────────────────────────────────────────────────────

function checkToolExists(toolName, availableTools) {
  return availableTools.some((t) => t.name === toolName);
}

function checkStatusMatch(expectedStatus, actualResult) {
  const actualIsError = actualResult?.isError === true;
  if (expectedStatus === 'error') return actualIsError;
  return !actualIsError;
}

function checkSchemaShape(expectedResponse, actualResult) {
  if (!expectedResponse || !actualResult) return { match: true, diffs: [] };
  const diffs = [];

  // Compare top-level keys
  const expectedKeys = Object.keys(expectedResponse).sort();
  const actualKeys = Object.keys(actualResult).sort();

  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) {
      diffs.push(`missing field "${key}"`);
    }
  }

  // Check content array shape if present
  if (expectedResponse.content && actualResult.content) {
    if (!Array.isArray(actualResult.content)) {
      diffs.push('content is not an array');
    } else if (expectedResponse.content.length > 0 && actualResult.content.length === 0) {
      diffs.push('content array is empty but expected items');
    }
  }

  return { match: diffs.length === 0, diffs };
}

function checkErrorCodeMatch(expectedErrorCode, actualResult) {
  if (!expectedErrorCode) return true;
  // Check if the actual result contains the same error code
  const actualStr = JSON.stringify(actualResult);
  return actualStr.includes(expectedErrorCode);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Loading journey: ${journeyPath}`);
  const journeyContent = await readFile(journeyPath, 'utf8');
  const journey = JSON.parse(journeyContent);

  const { meta, events } = journey;
  console.log(`Journey: ${meta.correlation_id} (${meta.tool_count} tools, tenant: ${meta.tenant_id})`);
  console.log(`Tool sequence: ${meta.tool_sequence?.join(' → ') || 'unknown'}`);
  console.log('');

  if (dryRun) {
    console.log('Dry run: journey file is valid. Events:');
    for (const event of events) {
      console.log(`  [${event.seq}] ${event.tool_name} (${event.status})`);
    }
    return;
  }

  // Fetch available tools from server
  console.log(`Connecting to: ${serverUrl}`);
  const availableTools = await mcpToolsList();
  console.log(`Server has ${availableTools.length} tools available\n`);

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  const results = [];

  for (const event of events) {
    const checks = [];
    let hasFailure = false;

    // Check 1: tool-exists (level 1+)
    const toolExists = checkToolExists(event.tool_name, availableTools);
    if (toolExists) {
      checks.push('tool exists');
    } else {
      checks.push('FAIL: tool not found on server');
      hasFailure = true;
    }

    if (!toolExists || !event.request) {
      // Can't replay without tool or request args
      const status = hasFailure ? 'FAIL' : 'SKIP';
      console.log(`  [${status}] ${event.tool_name.padEnd(12)} - ${checks.join(', ')}`);
      if (hasFailure) failCount++;
      else warnCount++;
      results.push({ event: event.tool_name, status, checks });
      continue;
    }

    // Execute the tool call
    let actualResult;
    try {
      actualResult = await mcpToolCall(event.tool_name, event.request);
    } catch (err) {
      checks.push(`FAIL: request error: ${err.message}`);
      hasFailure = true;
      console.log(`  [FAIL] ${event.tool_name.padEnd(12)} - ${checks.join(', ')}`);
      failCount++;
      results.push({ event: event.tool_name, status: 'FAIL', checks });
      continue;
    }

    // Check 2: status-match (level 1+)
    const statusMatch = checkStatusMatch(event.status, actualResult);
    if (statusMatch) {
      checks.push('status match');
    } else {
      checks.push(`FAIL: status mismatch (expected ${event.status})`);
      hasFailure = true;
    }

    // Check 3: error-code-match (level 1+)
    if (event.error_code) {
      const errorCodeMatch = checkErrorCodeMatch(event.error_code, actualResult);
      if (errorCodeMatch) {
        checks.push('error code match');
      } else {
        checks.push(`WARN: error code mismatch (expected ${event.error_code})`);
        warnCount++;
      }
    }

    // Check 4: schema-shape (level 2+)
    if (event.response) {
      const shapeResult = checkSchemaShape(event.response, actualResult);
      if (shapeResult.match) {
        checks.push('schema match');
      } else {
        checks.push(`FAIL: schema drift: ${shapeResult.diffs.join(', ')}`);
        hasFailure = true;
      }
    }

    const status = hasFailure ? 'FAIL' : 'PASS';
    if (hasFailure) failCount++;
    else passCount++;

    console.log(`  [${status}] ${event.tool_name.padEnd(12)} - ${checks.join(', ')}`);
    results.push({ event: event.tool_name, status, checks });
  }

  // Summary
  console.log(`\nResult: ${passCount}/${events.length} passed, ${failCount} failed, ${warnCount} warnings`);

  if (strictMode && failCount > 0) {
    console.log('\nStrict mode: exiting with code 1 due to drift');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Journey replay failed:', err);
  process.exit(1);
});
