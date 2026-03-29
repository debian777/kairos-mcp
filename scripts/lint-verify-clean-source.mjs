#!/usr/bin/env node
// Verify source cleanliness before build
// Fails the build on:
//  - console.* usage in src/** (log, warn, error, info, debug, etc.)
//  - mocking usage/imports in src/** (jest/vitest/sinon/nock/msw/fetch-mock)
//  - __mocks__ or /mocks/ directories under src
//
// Implementation notes:
//  - Uses TypeScript AST to avoid false positives from comments/strings
//  - Prints file:line:col with a short code excerpt

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const SRC_DIR = path.join(projectRoot, 'src');
const INTEG_DIR = path.join(projectRoot, 'tests', 'integration');

const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md']);

/** @typedef {{
 *  type: 'console.*' | 'mock-call' | 'mock-member' | 'mock-import' | 'mock-path';
 *  file: string;
 *  line: number;
 *  col: number;
 *  message: string;
 *  snippet?: string;
 * }} Violation
 */

/** Traverse directory recursively and yield file paths */
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip build output and node_modules just in case
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      yield* walk(p);
    } else if (exts.has(path.extname(e.name))) {
      yield p;
    }
  }
}

function getScriptKindForFile(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.ts': return ts.ScriptKind.TS;
    case '.tsx': return ts.ScriptKind.TSX;
    case '.js': return ts.ScriptKind.JS;
    case '.jsx': return ts.ScriptKind.JSX;
    case '.mjs': return ts.ScriptKind.JS;
    case '.cjs': return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

const bannedMockModules = new Set([
  'jest',
  '@jest/globals',
  'vitest',
  'sinon',
  'nock',
  'msw',
  '@mswjs/msw',
  '@mswjs/node',
  'fetch-mock',
  'jest-mock',
]);

const bannedMockMemberNames = new Set([
  'mockImplementation',
  'mockReturnValue',
  'mockResolvedValue',
  'mockRejectedValue',
  'mockClear',
  'mockReset',
  'mockRestore',
]);

/** @param {ts.SourceFile} sf */
function getLineCol(sf, pos) {
  const lc = sf.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, col: lc.character + 1 };
}

/** Extract the full line text for context */
function getLineSnippet(text, line) {
  const lines = text.split(/\r?\n/);
  return lines[Math.max(0, Math.min(lines.length - 1, line - 1))]?.trim() ?? '';
}

/** Analyze a single file and return violations */
function analyzeFile(filePath, text, policy) {
  /** @type {Violation[]} */
  const violations = [];
  
  // Path-based mocks check (applies to all file types)
  if (policy.banMockDirs) {
    if (filePath.includes(`${path.sep}__mocks__${path.sep}`) || filePath.includes(`${path.sep}mocks${path.sep}`)) {
      const { line, col } = { line: 1, col: 1 };
      violations.push({ type: 'mock-path', file: filePath, line, col, message: 'Mock directory detected in restricted area', snippet: '' });
    }
  }
  
  // For markdown files, only check path-based violations (no TypeScript parsing)
  if (filePath.endsWith('.md')) {
    return violations;
  }
  
  const kind = getScriptKindForFile(filePath);
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind);

  function visit(node) {
    // console.* detection (all console methods: log, warn, error, info, debug, etc.)
    if (policy.banConsoleLog) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr.expression) && expr.expression.text === 'console' && ts.isIdentifier(expr.name)) {
          const methodName = expr.name.text;
          const { line, col } = getLineCol(sf, node.getStart());
          violations.push({
            type: 'console.*',
            file: filePath,
            line,
            col,
            message: `console.${methodName}() is not allowed here`,
            snippet: getLineSnippet(text, line),
          });
        }
      }
    }

    // mock() calls: jest.mock/vi.mock/vitest.mock
    if (policy.banMocks) {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name) && callee.name.text === 'mock') {
          const base = callee.expression;
          if (ts.isIdentifier(base) && (base.text === 'jest' || base.text === 'vi' || base.text === 'vitest')) {
            const { line, col } = getLineCol(sf, node.getStart()); 
            violations.push({ type: 'mock-call', file: filePath, line, col, message: `${base.text}.mock() not allowed here`, snippet: getLineSnippet(text, line) });
          }
        }
        // nock(...) direct calls
        if (ts.isIdentifier(callee) && callee.text === 'nock') {
          const { line, col } = getLineCol(sf, node.getStart());
          violations.push({ type: 'mock-call', file: filePath, line, col, message: 'nock() not allowed here', snippet: getLineSnippet(text, line) });
        }
      }
    }

    // .mockImplementation(), .mockReturnValue(), etc.
    if (policy.banMocks) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name?.text;
        if (name && bannedMockMemberNames.has(name)) {
          const { line, col } = getLineCol(sf, node.getStart());
          violations.push({ type: 'mock-member', file: filePath, line, col, message: `.${name}() not allowed here`, snippet: getLineSnippet(text, line) });
        }
      }
    }

    // import ... from 'jest' / 'vitest' / 'sinon' / 'nock' / 'msw' ...
    if (policy.banMocks) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const mod = node.moduleSpecifier.text;
        if (bannedMockModules.has(mod) || mod.startsWith('@mswjs/')) {
          const { line, col } = getLineCol(sf, node.getStart());
          violations.push({ type: 'mock-import', file: filePath, line, col, message: `Import from '${mod}' not allowed here`, snippet: getLineSnippet(text, line) });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

async function main() {
  const start = Date.now();
  let allViolations = [];

  const targets = [
    {
      dir: SRC_DIR,
      policy: { banConsoleLog: true, banMocks: true, banMockDirs: true },
      label: 'src/**',
    },
    {
      dir: INTEG_DIR,
      policy: { banConsoleLog: false, banMocks: true, banMockDirs: true },
      label: 'tests/integration/**',
    },
  ];

  for (const t of targets) {
    try { await fs.access(t.dir); } catch { continue; }
    for await (const filePath of walk(t.dir)) {
      if (!filePath.startsWith(t.dir)) continue;
      const rel = path.relative(projectRoot, filePath);
      const text = await fs.readFile(filePath, 'utf8');
      const vs = analyzeFile(rel, text, t.policy);
      allViolations.push(...vs);
    }
  }

  if (allViolations.length > 0) {
    console.error('\n\u274c Prebuild verification failed. Clean your source before building.');
    // Group by file for clearer output
    const byFile = new Map();
    for (const v of allViolations) {
      if (!byFile.has(v.file)) byFile.set(v.file, []);
      byFile.get(v.file).push(v);
    }
    for (const [file, list] of byFile.entries()) {
      console.error(`\n\u25B6 File: ${file}`);
      for (const v of list) {
        const kind = v.type.padEnd(12, ' ');
        console.error(`  - [${kind}] ${v.line}:${v.col}  ${v.message}`);
        if (v.snippet) console.error(`    > ${v.snippet}`);
      }
    }
    console.error(`\nTotal violations: ${allViolations.length}`);
    console.error('Policy: No mocks in src/** or tests/integration/**, and no console.* in src/**. Build blocked.');
    process.exit(1);
  }

  const ms = Date.now() - start;
  console.log(`\u2705 Prebuild verification passed in ${ms}ms (no mocks or console.* in src)`);
}

main().catch((err) => {
  console.error('Verifier crashed:', err?.stack || err?.message || err);
  process.exit(1);
});
