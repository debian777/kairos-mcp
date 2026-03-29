#!/usr/bin/env node
/**
 * One-shot: train docs/examples/protocol-twelve-step-linear-test.md via local MCP train.
 * Uses same auth as integration tests when AUTH_ENABLED.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadIntegrationBearer, buildAuthHeaders } from './ai-mcp-integration-auth-utils.mjs';
import { resolveKairosAppBaseUrl } from './dev-app-base-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOC = path.join(ROOT, 'docs/examples/protocol-twelve-step-linear-test.md');

const BASE = resolveKairosAppBaseUrl().replace(/\/$/, '');
const MCP_URL = `${BASE}/mcp`;
const bearer = loadIntegrationBearer(ROOT);

async function authedFetch(input, init) {
  const headers = new Headers(init?.headers);
  const h = buildAuthHeaders(bearer);
  if (h.Authorization) headers.set('Authorization', h.Authorization);
  return fetch(input, { ...init, headers });
}

let markdown_doc = fs.readFileSync(DOC, 'utf8');
/** Distinct H1: similarity search uses adapter title + first H2 ("Natural Language Triggers"). */
const uniqueTitle = `Linear Comment Drill ${crypto.randomBytes(6).toString('hex')}`;
markdown_doc = markdown_doc.replace(/^#\s+.+$/m, `# ${uniqueTitle}`);
const client = new Client({ name: 'run-train-twelve-step', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: authedFetch });
await client.connect(transport);

const result = await client.callTool({
  name: 'train',
  arguments: {
    markdown_doc,
    llm_model_id: 'dev-12-step-linear',
    space: 'personal',
    protocol_version: '0.1.0-test',
    force_update: true
  }
});

const text = result.content?.find((c) => c.type === 'text')?.text;
if (text) {
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
} else {
  console.log(JSON.stringify(result, null, 2));
}

await client.close();
