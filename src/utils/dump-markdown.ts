/**
 * YAML frontmatter for protocol dumps (round-trip with train).
 * Slug and version values are constrained when storing via train; kept single-line.
 */
export function buildProtocolYamlFrontmatter(slug: string, protocolVersion?: string, chainRoot?: string): string {
  const s = (slug || '').trim();
  const lines = ['---', `slug: ${s || 'protocol'}`];
  const v = protocolVersion?.trim();
  if (v) lines.push(`version: ${v}`);
  const cr = chainRoot?.trim();
  if (cr) lines.push(`chain_root: ${cr}`);
  lines.push('---', '');
  // Blank line after frontmatter before H1
  return `${lines.join('\n')}\n`;
}

/**
 * Remove a redundant H2 that matches the step label from memory body before
 * protocol dump prepends `## {label}`.
 *
 * Minting derives `label` from the first `##` line in the segment (any line),
 * but the stored body can include prose before that heading. The previous
 * implementation only stripped when `## label` was the first line, which
 * produced duplicate H2s in protocol dump output.
 */
export function stripRedundantStepH2(body: string, label: string): string {
  if (!body || !label) return body;
  const labelNorm = label.trim();
  if (!labelNorm) return body;

  const lines = body.split(/\r?\n/);
  let inFence = false;
  let matchIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i]!.trim();
    if (trimmedLine.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = lines[i]!.match(/^\s*##\s+(.+)\s*$/);
    if (m && m[1]!.trim() === labelNorm) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) return body;

  const next = [...lines.slice(0, matchIndex), ...lines.slice(matchIndex + 1)];
  // Removing "## Title" often leaves two blank lines where one is enough
  if (
    matchIndex > 0 &&
    matchIndex < next.length &&
    next[matchIndex - 1] === '' &&
    next[matchIndex] === ''
  ) {
    next.splice(matchIndex, 1);
  }
  return next.join('\n').trimStart();
}
