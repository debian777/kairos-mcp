#!/usr/bin/env node
/**
 * AI–MCP integration: run protocols on KAIROS (kairos-dev).
 * Implements docs/examples/ai-mcp-integration.md:
 * - Import each protocol from docs/examples/protocol-example-*.md via POST /api/kairos_mint/raw
 * - Search, begin, next (loop) until next_action says kairos_attest
 * - Write one report per protocol under reports/<run-id>/<protocol-folder>/report.md
 *
 * Usage: node scripts/run-ai-mcp-integration.mjs
 * Env:   KAIROS_BASE_URL (default http://localhost:3300), RUN_ID (default workflow-YYYY-MM-DD-HHmmss)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const RUN_ID = process.env.RUN_ID || defaultRunId();

const KAIROS_URI_REGEX = /kairos:\/\/mem\/[a-f0-9-]+/gi;

function extractUriFromNextAction(nextAction) {
  if (!nextAction || typeof nextAction !== 'string') return null;
  const m = nextAction.match(KAIROS_URI_REGEX);
  return m ? m[0] : null;
}

function buildSolution(challenge, proofHashFromPrevious) {
  const type = challenge?.type || 'comment';
  const nonce = challenge?.nonce;
  const proof_hash = challenge?.proof_hash ?? proofHashFromPrevious;
  const base = { nonce, proof_hash }.filter(([, v]) => v != null);
  const withProof = (sol) => ({ ...sol, ...base });

  switch (type) {
    case 'user_input':
      return withProof({
        type: 'user_input',
        user_input: { confirmation: 'Yes, approved.' }
      });
    case 'comment': {
      const minLen = challenge?.comment?.min_length ?? 50;
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
          tool_name: challenge?.mcp?.tool_name || 'kairos_search',
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

async function mint(baseUrl, markdown, llmModelId = 'ai-mcp-integration', force = true) {
  const url = `${baseUrl}/api/kairos_mint/raw?llm_model_id=${encodeURIComponent(llmModelId)}&force=${force}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown' },
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

async function search(baseUrl, query) {
  const res = await fetch(`${baseUrl}/api/kairos_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function begin(baseUrl, uri) {
  const res = await fetch(`${baseUrl}/api/kairos_begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri })
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function next(baseUrl, uri, solution) {
  const res = await fetch(`${baseUrl}/api/kairos_next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri, solution })
  });
  const data = await res.json();
  return { status: res.status, data };
}

function searchQueryFromMarkdown(markdown) {
  const firstLine = markdown.split('\n').find((l) => l.startsWith('#'));
  if (firstLine) {
    return firstLine.replace(/^#\s*/, '').trim();
  }
  return 'Example protocol';
}

function getFirstMatchUri(searchData) {
  const choices = searchData?.choices;
  if (!Array.isArray(choices)) return null;
  const match = choices.find((c) => c.role === 'match');
  return match?.uri ?? choices[0]?.uri ?? null;
}

function section(title, request, response) {
  return `### ${title}\n\n**Request:**\n\n\`\`\`json\n${JSON.stringify(request, null, 2)}\n\`\`\`\n\n**Response:**\n\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\`\n\n`;
}

async function runProtocol(baseUrl, protocolName, markdown, reportPath) {
  const steps = [];
  let proofHashFromPrevious = undefined;

  const mintRes = await mint(baseUrl, markdown);
  steps.push({
    title: 'Import (kairos_mint)',
    what: 'Minted protocol markdown via POST /api/kairos_mint/raw.',
    request: { body: '(raw markdown)', query: 'llm_model_id=ai-mcp-integration&force=true' },
    response: mintRes.data
  });

  if (mintRes.status !== 200 || mintRes.data.error) {
    const report = [
      `# ${protocolName}\n\n`,
      '## Import\n\n',
      section('Mint', steps[0].request, steps[0].response),
      'Workflow stopped: mint failed or returned error.\n'
    ].join('');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report, 'utf8');
    return;
  }

  const searchQuery = searchQueryFromMarkdown(markdown);
  const searchRes = await search(baseUrl, searchQuery);
  steps.push({
    title: 'Search',
    what: `Searched with query "${searchQuery}" to find the chain.`,
    request: { query: searchQuery },
    response: searchRes.data
  });

  const beginUri = getFirstMatchUri(searchRes.data);
  if (!beginUri) {
    const report = [
      `# ${protocolName}\n\n`,
      steps.map((s) => `## ${s.title}\n\n${section(s.title, s.request, s.response)}`).join(''),
      'Workflow stopped: no match from search.\n'
    ].join('');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report, 'utf8');
    return;
  }

  let beginRes = await begin(baseUrl, beginUri);
  steps.push({
    title: 'Begin',
    what: `Called kairos_begin with chain head URI to load step 1.`,
    request: { uri: beginUri },
    response: beginRes.data
  });

  let nextUri = extractUriFromNextAction(beginRes.data?.next_action);
  let stepIndex = 1;
  while (nextUri) {
    const challenge = beginRes.data?.challenge;
    proofHashFromPrevious = challenge?.proof_hash ?? beginRes.data?.proof_hash ?? proofHashFromPrevious;
    const solution = buildSolution(challenge, proofHashFromPrevious);

    const nextRes = await next(baseUrl, nextUri, solution);
    steps.push({
      title: `Next (step ${stepIndex + 1})`,
      what: `Submitted solution for step ${stepIndex} (${challenge?.type || 'unknown'}); advancing to next step.`,
      request: { uri: nextUri, solution },
      response: nextRes.data
    });
    if (nextRes.data?.error_code) break;
    if (nextRes.data?.next_action?.includes('kairos_attest')) break;
    beginRes = { data: nextRes.data };
    nextUri = extractUriFromNextAction(nextRes.data?.next_action);
    stepIndex++;
  }

  const report = [
    `# ${protocolName}\n\n`,
    'Flow: Import → Search → Begin → Next (until completion).\n\n',
    ...steps.map((s) => `## ${s.title}\n\n${s.what}\n\n${section(s.title, s.request, s.response)}`)
  ].join('');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf8');
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
