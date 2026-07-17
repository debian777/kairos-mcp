#!/usr/bin/env node
// build-wiki.mjs - Transform the Qoder Repo Wiki source tree into a flat,
// navigable GitHub Wiki.
//
// GitHub Wiki is a FLAT namespace: it discards the source directory hierarchy
// and renders one alphabetical "Pages" list. Mirroring the nested source tree
// verbatim therefore produces a wall of ~120 pages with confusing duplicate
// titles (the same basename living at several depths) and no navigation.
//
// This builder fixes that deterministically, WITHOUT editing the Qoder-managed
// source content:
//   - Every page is renamed to a collision-free, self-describing title derived
//     from its full path (e.g. "Core Concepts - Memory System - ...").
//   - Redundant folder-index duplication (".../X/X.md") is collapsed.
//   - A hierarchical `_Sidebar.md` and a landing `Home.md` are generated from
//     the tree so readers navigate by structure, not by the flat Pages list.
//   - Dead `file://<repo-path>` references are rewritten to clickable GitHub
//     blob URLs.
//
// Usage:
//   SOURCE_DIR=<abs content dir> node scripts/build-wiki.mjs <out-dir>
//
// Environment / arguments:
//   SOURCE_DIR   Source content dir (default: .qoder/repowiki/en/content).
//   <out-dir>    Destination build dir (required). Recreated fresh each run.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO_OWNER = 'debian777';
const REPO_NAME = 'kairos-mcp';
const REPO_BRANCH = 'main';
const BLOB_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}/`;

const SOURCE_DIR = process.env.SOURCE_DIR || '.qoder/repowiki/en/content';
const OUT_DIR = process.argv[2] || process.env.OUT_DIR;

if (!OUT_DIR) {
  console.error('Error: output directory is required.');
  console.error('Usage: SOURCE_DIR=<dir> node scripts/build-wiki.mjs <out-dir>');
  process.exit(1);
}

// --- naming --------------------------------------------------------------

// GitHub Wiki keys page URLs by filename with spaces replaced by hyphens; other
// characters are preserved. Wrap link targets in <> so preserved characters
// (e.g. parentheses) never break Markdown link parsing.
function slug(pageName) {
  return pageName.replace(/ /g, '-');
}

function link(display, pageName) {
  return `[${display}](<${slug(pageName)}>)`;
}

// Full-path page name, collapsing a folder-index tail (".../X/X.md" -> ".../X").
// Path segments are unique, so the result is always collision-free.
function pageNameFor(relPathPosix) {
  const noExt = relPathPosix.replace(/\.md$/i, '');
  const segs = noExt.split('/');
  if (segs.length >= 2 && segs[segs.length - 1] === segs[segs.length - 2]) {
    segs.pop();
  }
  return segs.join(' - ');
}

// Rewrite `[text](file://<repo-path>)` references to clickable GitHub blob URLs.
function rewriteSourceLinks(content) {
  return content.split('](file://').join(`](${BLOB_BASE}`);
}

// --- tree ----------------------------------------------------------------

// node: { name, indexPage, pages: [{display, pageName}], sections: [node] }
async function buildDir(absDir, relSegs) {
  const dirName = relSegs.length ? relSegs[relSegs.length - 1] : null;
  const node = { name: dirName, indexPage: null, pages: [], sections: [] };
  const entries = await fs.readdir(absDir, { withFileTypes: true });

  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  for (const file of mdFiles) {
    const base = file.replace(/\.md$/i, '');
    const relPath = [...relSegs, file].join('/');
    const pageName = pageNameFor(relPath);
    if (dirName && base === dirName) {
      node.indexPage = pageName; // section landing page
    } else {
      node.pages.push({ display: base, pageName, relPath });
    }
  }

  const subDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  for (const dir of subDirs) {
    node.sections.push(await buildDir(path.join(absDir, dir), [...relSegs, dir]));
  }

  return node;
}

// Collect every emitted page (flat) from the tree, in write order.
function collectPages(node, acc) {
  if (node.indexPage) acc.push({ display: node.name, pageName: node.indexPage });
  for (const p of node.pages) acc.push(p);
  for (const s of node.sections) collectPages(s, acc);
  return acc;
}

// --- navigation rendering ------------------------------------------------

function renderSection(node, depth, lines, maxDepth) {
  const indent = '  '.repeat(depth);
  if (node.indexPage) {
    lines.push(`${indent}- ${link(node.name, node.indexPage)}`);
  } else {
    lines.push(`${indent}- **${node.name}**`);
  }

  const childIndent = '  '.repeat(depth + 1);
  for (const p of node.pages) {
    lines.push(`${childIndent}- ${link(p.display, p.pageName)}`);
  }
  for (const s of node.sections) {
    if (depth + 1 <= maxDepth) {
      renderSection(s, depth + 1, lines, maxDepth);
    } else if (s.indexPage) {
      lines.push(`${childIndent}- ${link(s.name, s.indexPage)}`);
    } else {
      lines.push(`${childIndent}- **${s.name}**`);
    }
  }
}

function renderRoot(root, maxDepth) {
  const lines = [];
  for (const s of root.sections) renderSection(s, 0, lines, maxDepth);
  for (const p of root.pages) lines.push(`- ${link(p.display, p.pageName)}`);
  return lines.join('\n');
}

function buildSidebar(root) {
  return ['### KAIROS MCP', '', `- ${link('Home', 'Home')}`, '', renderRoot(root, Infinity), ''].join('\n');
}

function buildHome(root) {
  return [
    '# KAIROS MCP Wiki',
    '',
    'KAIROS MCP is a Model Context Protocol server for persistent memory and',
    'deterministic adapter execution. It stores workflows as linked adapters',
    'whose layers can carry proof-of-work challenges.',
    '',
    'This wiki is generated from the repository and published automatically —',
    'do not edit pages here by hand. Use the sidebar or the sections below to',
    'navigate.',
    '',
    '## Sections',
    '',
    renderRoot(root, 1),
    '',
  ].join('\n');
}

// --- main ----------------------------------------------------------------

async function main() {
  const sourceAbs = path.resolve(SOURCE_DIR);
  const outAbs = path.resolve(OUT_DIR);

  const stat = await fs.stat(sourceAbs).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Error: source directory '${sourceAbs}' not found.`);
    process.exit(1);
  }

  const root = await buildDir(sourceAbs, []);

  // Emit pages; assert global uniqueness (defensive — should never trigger).
  const pages = collectPages(root, []);
  const seen = new Map();
  for (const p of pages) {
    if (seen.has(p.pageName)) {
      console.error(`Error: duplicate page name '${p.pageName}'`);
      console.error(`  first : ${seen.get(p.pageName)}`);
      console.error(`  second: ${p.relPath ?? '(index)'}`);
      process.exit(1);
    }
    seen.set(p.pageName, p.relPath ?? '(index)');
  }

  await fs.rm(outAbs, { recursive: true, force: true });
  await fs.mkdir(outAbs, { recursive: true });

  let count = 0;
  const writeOne = async (pageName, relPath) => {
    const raw = await fs.readFile(path.join(sourceAbs, relPath), 'utf8');
    await fs.writeFile(path.join(outAbs, `${pageName}.md`), rewriteSourceLinks(raw));
    count += 1;
  };

  // Re-walk to get relPath for index pages too.
  const writeTree = async (node, relSegs) => {
    if (node.indexPage) {
      await writeOne(node.indexPage, [...relSegs, `${node.name}.md`].join('/'));
    }
    for (const p of node.pages) await writeOne(p.pageName, p.relPath);
    for (const s of node.sections) await writeTree(s, [...relSegs, s.name]);
  };
  await writeTree(root, []);

  await fs.writeFile(path.join(outAbs, 'Home.md'), buildHome(root));
  await fs.writeFile(path.join(outAbs, '_Sidebar.md'), buildSidebar(root));

  console.log(`Built ${count} page(s) + Home + _Sidebar into ${outAbs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
