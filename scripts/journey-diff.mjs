#!/usr/bin/env node
/** Journey diff: compare two journey sets, report tool sequence/shape/error/timing drift. */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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
  console.log('Journey diff: compare two journey sets, report drift\n\nUsage: node scripts/journey-diff.mjs --baseline <dir> --current <dir> [--out <path>] [--timing-threshold <n>]\n');
  process.exit(0);
}

const baselineDir = resolve(getArg('baseline') || '');
const currentDir = resolve(getArg('current') || '');
const outPath = getArg('out');
const timingThreshold = parseFloat(getArg('timing-threshold') || '2.0');

if (!getArg('baseline') || !getArg('current')) {
  console.error('Error: --baseline and --current are required');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadJourneys(dirPath) {
  const files = await readdir(dirPath).catch(() => []);
  const journeys = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(join(dirPath, file), 'utf8');
      journeys.push(JSON.parse(content));
    } catch {
      // Skip malformed files
    }
  }
  return journeys;
}

function getToolSequence(journey) {
  return journey.events?.map((e) => e.tool_name) || [];
}

function getToolSet(journey) {
  return new Set(getToolSequence(journey));
}

function getResponseKeys(event) {
  if (!event.response || typeof event.response !== 'object') return [];
  return Object.keys(event.response).sort();
}

function computeAvgDuration(journeys, toolName) {
  const durations = [];
  for (const j of journeys) {
    for (const e of j.events || []) {
      if (e.tool_name === toolName && typeof e.duration_ms === 'number') {
        durations.push(e.duration_ms);
      }
    }
  }
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

function computeErrorRate(journeys, toolName) {
  let total = 0;
  let errors = 0;
  for (const j of journeys) {
    for (const e of j.events || []) {
      if (e.tool_name === toolName) {
        total++;
        if (e.status === 'error') errors++;
      }
    }
  }
  if (total === 0) return null;
  return errors / total;
}

// ── Diff analysis ────────────────────────────────────────────────────────────

function analyzeDrift(baselineJourneys, currentJourneys) {
  const report = {
    summary: {
      baseline_journeys: baselineJourneys.length,
      current_journeys: currentJourneys.length
    },
    toolSequenceDrift: [],
    newTools: [],
    removedTools: [],
    responseShapeDrift: [],
    errorRateDelta: [],
    timingDrift: []
  };

  // Collect all tool names across both sets
  const baselineTools = new Set();
  const currentTools = new Set();
  for (const j of baselineJourneys) {
    for (const t of getToolSet(j)) baselineTools.add(t);
  }
  for (const j of currentJourneys) {
    for (const t of getToolSet(j)) currentTools.add(t);
  }

  // New/removed tools
  for (const t of currentTools) {
    if (!baselineTools.has(t)) report.newTools.push(t);
  }
  for (const t of baselineTools) {
    if (!currentTools.has(t)) report.removedTools.push(t);
  }

  // Tool sequence drift: compare ordered sequences
  const baselineSeqs = baselineJourneys.map(getToolSequence);
  const currentSeqs = currentJourneys.map(getToolSequence);

  // Find most common baseline sequence
  const seqCounts = new Map();
  for (const seq of baselineSeqs) {
    const key = seq.join(',');
    seqCounts.set(key, (seqCounts.get(key) || 0) + 1);
  }
  const dominantBaselineSeq = [...seqCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  for (let i = 0; i < currentSeqs.length; i++) {
    const currentSeq = currentSeqs[i].join(',');
    if (currentSeq !== dominantBaselineSeq && currentSeq.length > 0) {
      report.toolSequenceDrift.push({
        journey_index: i,
        baseline_dominant: dominantBaselineSeq,
        current: currentSeq
      });
    }
  }

  // Response shape drift and timing/error analysis per tool
  const allTools = [...new Set([...baselineTools, ...currentTools])].sort();

  for (const toolName of allTools) {
    // Response shape drift
    const baselineShapes = new Set();
    const currentShapes = new Set();

    for (const j of baselineJourneys) {
      for (const e of j.events || []) {
        if (e.tool_name === toolName && e.response) {
          baselineShapes.add(getResponseKeys(e).join(','));
        }
      }
    }
    for (const j of currentJourneys) {
      for (const e of j.events || []) {
        if (e.tool_name === toolName && e.response) {
          currentShapes.add(getResponseKeys(e).join(','));
        }
      }
    }

    for (const shape of currentShapes) {
      if (!baselineShapes.has(shape) && baselineShapes.size > 0) {
        report.responseShapeDrift.push({
          tool: toolName,
          baseline_shapes: [...baselineShapes],
          new_shape: shape
        });
      }
    }

    // Error rate delta
    const baselineErrorRate = computeErrorRate(baselineJourneys, toolName);
    const currentErrorRate = computeErrorRate(currentJourneys, toolName);
    if (baselineErrorRate !== null && currentErrorRate !== null) {
      const delta = currentErrorRate - baselineErrorRate;
      if (Math.abs(delta) > 0.01) {
        report.errorRateDelta.push({
          tool: toolName,
          baseline: baselineErrorRate.toFixed(3),
          current: currentErrorRate.toFixed(3),
          delta: delta.toFixed(3)
        });
      }
    }

    // Timing drift
    const baselineAvg = computeAvgDuration(baselineJourneys, toolName);
    const currentAvg = computeAvgDuration(currentJourneys, toolName);
    if (baselineAvg !== null && currentAvg !== null && baselineAvg > 0) {
      const ratio = currentAvg / baselineAvg;
      if (ratio >= timingThreshold) {
        report.timingDrift.push({
          tool: toolName,
          baseline_ms: Math.round(baselineAvg),
          current_ms: Math.round(currentAvg),
          ratio: ratio.toFixed(1) + 'x'
        });
      }
    }
  }

  return report;
}

// ── Report formatting ────────────────────────────────────────────────────────

function formatMarkdown(report) {
  const lines = [];
  lines.push('# Journey Diff Report');
  lines.push('');
  lines.push(`Baseline: ${report.summary.baseline_journeys} journeys`);
  lines.push(`Current: ${report.summary.current_journeys} journeys`);
  lines.push('');

  const hasDrift = report.newTools.length > 0 ||
    report.removedTools.length > 0 ||
    report.toolSequenceDrift.length > 0 ||
    report.responseShapeDrift.length > 0 ||
    report.errorRateDelta.length > 0 ||
    report.timingDrift.length > 0;

  if (!hasDrift) {
    lines.push('**No drift detected.**');
    return lines.join('\n');
  }

  if (report.newTools.length > 0) {
    lines.push('## New Tools');
    lines.push('');
    for (const t of report.newTools) lines.push(`- \`${t}\``);
    lines.push('');
  }

  if (report.removedTools.length > 0) {
    lines.push('## Removed Tools');
    lines.push('');
    for (const t of report.removedTools) lines.push(`- \`${t}\``);
    lines.push('');
  }

  if (report.toolSequenceDrift.length > 0) {
    lines.push('## Tool Sequence Drift');
    lines.push('');
    lines.push('| Journey | Baseline (dominant) | Current |');
    lines.push('|---------|---------------------|---------|');
    for (const d of report.toolSequenceDrift) {
      lines.push(`| ${d.journey_index} | \`${d.baseline_dominant}\` | \`${d.current}\` |`);
    }
    lines.push('');
  }

  if (report.responseShapeDrift.length > 0) {
    lines.push('## Response Shape Drift');
    lines.push('');
    lines.push('| Tool | New Shape | Baseline Shapes |');
    lines.push('|------|-----------|-----------------|');
    for (const d of report.responseShapeDrift) {
      lines.push(`| \`${d.tool}\` | \`${d.new_shape}\` | ${d.baseline_shapes.map((s) => `\`${s}\``).join(', ')} |`);
    }
    lines.push('');
  }

  if (report.errorRateDelta.length > 0) {
    lines.push('## Error Rate Delta');
    lines.push('');
    lines.push('| Tool | Baseline | Current | Delta |');
    lines.push('|------|----------|---------|-------|');
    for (const d of report.errorRateDelta) {
      const sign = parseFloat(d.delta) > 0 ? '+' : '';
      lines.push(`| \`${d.tool}\` | ${(parseFloat(d.baseline) * 100).toFixed(1)}% | ${(parseFloat(d.current) * 100).toFixed(1)}% | ${sign}${(parseFloat(d.delta) * 100).toFixed(1)}% |`);
    }
    lines.push('');
  }

  if (report.timingDrift.length > 0) {
    lines.push(`## Timing Drift (>${timingThreshold}x)`);
    lines.push('');
    lines.push('| Tool | Baseline (avg) | Current (avg) | Ratio |');
    lines.push('|------|----------------|---------------|-------|');
    for (const d of report.timingDrift) {
      lines.push(`| \`${d.tool}\` | ${d.baseline_ms}ms | ${d.current_ms}ms | ${d.ratio} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Baseline: ${baselineDir}`);
  console.log(`Current: ${currentDir}`);

  const [baselineJourneys, currentJourneys] = await Promise.all([
    loadJourneys(baselineDir),
    loadJourneys(currentDir)
  ]);

  console.log(`Loaded ${baselineJourneys.length} baseline, ${currentJourneys.length} current journeys`);

  if (baselineJourneys.length === 0) {
    console.error('Error: no journey files found in baseline directory');
    process.exit(1);
  }
  if (currentJourneys.length === 0) {
    console.error('Error: no journey files found in current directory');
    process.exit(1);
  }

  const report = analyzeDrift(baselineJourneys, currentJourneys);
  const markdown = formatMarkdown(report);

  if (outPath) {
    await writeFile(resolve(outPath), markdown + '\n');
    console.log(`Report written to: ${outPath}`);
  } else {
    console.log('');
    console.log(markdown);
  }
}

main().catch((err) => {
  console.error('Journey diff failed:', err);
  process.exit(1);
});
