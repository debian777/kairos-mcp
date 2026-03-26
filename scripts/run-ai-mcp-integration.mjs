#!/usr/bin/env node
/**
 * AI-MCP integration: run example adapters against a KAIROS dev server.
 * - Store each example markdown document via POST /api/train/raw
 * - Activate the best match, then forward through each layer
 * - Finalize with reward when the run completes
 * - Write one report per example under reports/<run-id>/<protocol-folder>/report.md
 *
 * Usage: node scripts/run-ai-mcp-integration.mjs
 * Env:   KAIROS_BASE_URL (default http://localhost:3300), RUN_ID (default workflow-YYYY-MM-DD-HHmmss)
 *
 * Auth (when the dev server has Keycloak / AUTH_ENABLED): same bearer as Jest integration tests —
 * either `.test-auth-env.dev.json` in the repo root (written by globalSetup when you run
 * AUTH_ENABLED=true npm run dev:test after deploy), or override with env KAIROS_INTEGRATION_BEARER
 * (raw JWT string, no Bearer prefix).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  integrationReportSection,
  writeIntegrationReportFile
} from './ai-mcp-integration-report-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(ROOT, 'docs', 'examples');
const REPORTS_DIR = path.join(ROOT, 'reports');

const BASE_URL = process.env.KAIROS_BASE_URL || 'http://localhost:3300';
function defaultRunId() {
  const d = new Date();
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `workflow-${Y}-${M}-${D}-${h}${m}${s}`;
}
/** RUN_ID from env must stay within reports/ (no path segments). */
function resolveRunId() {
  const fromEnv = process.env.RUN_ID;
  if (!fromEnv) return defaultRunId();
  if (!/^[a-zA-Z0-9._-]+$/.test(fromEnv) || fromEnv.length > 200) {
    throw new Error('RUN_ID must be alphanumeric plus ._- only and length <= 200');
  }
  return fromEnv;
}
const RUN_ID = resolveRunId();

/** @returns {string | null} */
function loadIntegrationBearer() {
  const fromEnv = process.env.KAIROS_INTEGRATION_BEARER?.trim();
  if (fromEnv) return fromEnv;
  const authPath = path.join(ROOT, '.test-auth-env.dev.json');
  try {
    if (!fs.existsSync(authPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const t = parsed?.bearerToken;
    return typeof t === 'string' && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

const INTEGRATION_BEARER = loadIntegrationBearer();

function authHeaders() {
  return INTEGRATION_BEARER ? { Authorization: `Bearer ${INTEGRATION_BEARER}` } : {};
}

const KAIROS_URI_REGEX = /kairos:\/\/(?:adapter|layer|mem)\/[a-f0-9-]+(?:\?execution_id=[a-f0-9-]+)?/gi;

function extractUriFromNextAction(nextAction) {
  if (!nextAction || typeof nextAction !== 'string') return null;
  const m = nextAction.match(KAIROS_URI_REGEX);
  return m ? m[0] : null;
}

function buildSolution(contract, proofHashFromPrevious) {
  const type = contract?.type || 'comment';
  const nonce = contract?.nonce;
  const proof_hash = contract?.proof_hash ?? proofHashFromPrevious;
  const base = {};
  if (nonce != null) base.nonce = nonce;
  if (proof_hash != null) base.proof_hash = proof_hash;
  const withProof = (solution) => ({ ...solution, ...base });

  switch (type) {
    case 'tensor':
      return withProof({
        type: 'tensor',
        tensor: {
          name: contract?.tensor?.output?.name || 'integration_output',
          value: 'ok'
        }
      });
    case 'user_input':
      return withProof({
        type: 'user_input',
        user_input: { confirmation: 'Yes, approved.' }
      });
    case 'comment': {
      const minLen = contract?.comment?.min_length ?? 50;
      let text = 'Summary of steps completed for this protocol run.';
      if (text.length < minLen) text = text.padEnd(minLen, ' ');
      return withProof({
        type: 'comment',
        comment: { text }
      });
    }
    case 'shell':
      return withProof({
        type: 'shell',
        shell: { exit_code: 0, stdout: 'ok' }
      });
    case 'mcp':
      return withProof({
        type: 'mcp',
        mcp: {
          tool_name: contract?.mcp?.tool_name || 'activate',
          result: 'ok',
          success: true
        }
      });
    default:
      return withProof({
        type: 'comment',
        comment: { text: 'Step completed as part of integration run.' }
      });
  }
}

async function train(baseUrl, markdown, llmModelId = 'ai-mcp-integration', force = true) {
  const url = `${baseUrl}/api/train/raw?llm_model_id=${encodeURIComponent(llmModelId)}&force=${force}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown', ...authHeaders() },
    body: markdown
  });
  const body = await res.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Mint non-JSON: ${body.slice(0, 200)}`);
  }
  return { status: res.status, data };
}

async function activate(baseUrl, query) {
  const res = await fetch(`${baseUrl}/api/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function forward(baseUrl, uri, solution) {
  const res = await fetch(`${baseUrl}/api/forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(solution === undefined ? { uri } : { uri, solution })
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function reward(baseUrl, uri, outcome = 'success', feedback = 'Integration run completed successfully.') {
  const res = await fetch(`${baseUrl}/api/reward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ uri, outcome, feedback })
  });
  const data = await res.json();
  return { status: res.status, data };
}

function activationQueryFromMarkdown(markdown) {
  const firstLine = markdown.split('\n').find((l) => l.startsWith('#'));
  if (firstLine) {
    return firstLine.replace(/^#\s*/, '').trim();
  }
  return 'Example adapter';
}

function getFirstMatchUri(activateData) {
  const choices = activateData?.choices;
  if (!Array.isArray(choices)) return null;
  const match = choices.find((c) => c.role === 'match');
  return match?.uri ?? choices[0]?.uri ?? null;
}

async function runProtocol(baseUrl, protocolName, markdown, reportPath) {
  const steps = [];
  let proofHashFromPrevious;

  const trainRes = await train(baseUrl, markdown);
  steps.push({
    title: 'Train',
    what: 'Stored adapter markdown via POST /api/train/raw.',
    request: { body: '(raw markdown)', query: 'llm_model_id=ai-mcp-integration&force=true' },
    response: trainRes.data
  });

  if (trainRes.status !== 200 || trainRes.data.error) {
    const report = [
      `# ${protocolName}\n\n`,
      '## Train\n\n',
      integrationReportSection('Train', steps[0].request, steps[0].response),
      'Workflow stopped: train failed or returned an error.\n'
    ].join('');
    writeIntegrationReportFile(reportPath, report, REPORTS_DIR);
    return;
  }

  const activationQuery = activationQueryFromMarkdown(markdown);
  const activateRes = await activate(baseUrl, activationQuery);
  steps.push({
    title: 'Activate',
    what: `Activated with query "${activationQuery}" to find the adapter.`,
    request: { query: activationQuery },
    response: activateRes.data
  });

  const adapterUri = getFirstMatchUri(activateRes.data);
  if (!adapterUri) {
    const report = [
      `# ${protocolName}\n\n`,
      steps.map((s) => `## ${s.title}\n\n${integrationReportSection(s.title, s.request, s.response)}`).join(''),
      'Workflow stopped: activate returned no runnable choice.\n'
    ].join('');
    writeIntegrationReportFile(reportPath, report, REPORTS_DIR);
    return;
  }

  let forwardRes = await forward(baseUrl, adapterUri);
  steps.push({
    title: 'Forward (start)',
    what: 'Started adapter execution with the selected adapter URI.',
    request: { uri: adapterUri },
    response: forwardRes.data
  });

  let stepIndex = 1;
  while (forwardRes.data?.current_layer?.uri && !String(forwardRes.data?.next_action || '').includes('call reward')) {
    const contract = forwardRes.data?.contract;
    proofHashFromPrevious = contract?.proof_hash ?? forwardRes.data?.proof_hash ?? proofHashFromPrevious;
    const solution = buildSolution(contract, proofHashFromPrevious);
    const layerUri = forwardRes.data.current_layer.uri;

    const nextRes = await forward(baseUrl, layerUri, solution);
    steps.push({
      title: `Forward (layer ${stepIndex})`,
      what: `Submitted a ${contract?.type || 'unknown'} solution for layer ${stepIndex}.`,
      request: { uri: layerUri, solution },
      response: nextRes.data
    });
    if (nextRes.data?.error_code) break;
    proofHashFromPrevious = nextRes.data?.proof_hash ?? proofHashFromPrevious;
    forwardRes = nextRes;
    stepIndex++;
  }

  const rewardUri = extractUriFromNextAction(forwardRes.data?.next_action) ?? forwardRes.data?.current_layer?.uri ?? null;
  if (!forwardRes.data?.error_code && rewardUri && String(forwardRes.data?.next_action || '').includes('call reward')) {
    const rewardRes = await reward(baseUrl, rewardUri);
    steps.push({
      title: 'Reward',
      what: 'Finalized the adapter execution with reward.',
      request: { uri: rewardUri, outcome: 'success', feedback: 'Integration run completed successfully.' },
      response: rewardRes.data
    });
  }

  const report = [
    `# ${protocolName}\n\n`,
    'Flow: Train → Activate → Forward (loop) → Reward.\n\n',
    ...steps.map(
      (s) => `## ${s.title}\n\n${s.what}\n\n${integrationReportSection(s.title, s.request, s.response)}`
    )
  ].join('');

  writeIntegrationReportFile(reportPath, report, REPORTS_DIR);
}

function listProtocolFiles() {
  const names = [
    'protocol-example-user-input.md',
    'protocol-example-comment.md',
    'protocol-example-mcp.md',
    'protocol-example-shell.md',
    'protocol-example-all-types.md'
  ];
  return names
    .map((name) => ({
      name,
      path: path.join(EXAMPLES_DIR, name)
    }))
    .filter((p) => fs.existsSync(p.path));
}

async function main() {
  console.log(`KAIROS_BASE_URL=${BASE_URL} RUN_ID=${RUN_ID}`);
  if (INTEGRATION_BEARER) {
    const src = process.env.KAIROS_INTEGRATION_BEARER?.trim() ? 'KAIROS_INTEGRATION_BEARER' : '.test-auth-env.dev.json';
    console.log(`Auth: Bearer from ${src}`);
  } else {
    console.warn(
      'Auth: no bearer token. With AUTH_ENABLED, use .test-auth-env.dev.json (e.g. AUTH_ENABLED=true npm run dev:test after deploy) or set KAIROS_INTEGRATION_BEARER.'
    );
  }
  const protocols = listProtocolFiles();
  console.log(`Protocols: ${protocols.map((p) => p.name).join(', ')}`);

  for (const { name, path: filePath } of protocols) {
    const protocolFolder = name.replace(/\.md$/, '');
    const markdown = fs.readFileSync(filePath, 'utf8');
    const reportPath = path.join(REPORTS_DIR, RUN_ID, protocolFolder, 'report.md');
    console.log(`Running ${name} -> ${reportPath}`);
    await runProtocol(BASE_URL, protocolFolder, markdown, reportPath);
  }

  console.log(`Done. Reports under reports/${RUN_ID}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
