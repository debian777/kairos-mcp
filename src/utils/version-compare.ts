/**
 * Compare two semver strings (major.minor.patch).
 * Returns:  1 if a > b, -1 if a < b, 0 if equal.
 *
 * Handles incomplete versions gracefully:
 *  - Missing parts are treated as 0 (e.g. "4.7" → [4,7,0]).
 *  - Non-numeric or empty strings are treated as [0,0,0].
 */
export function compareSemver(a: string | undefined | null, b: string | undefined | null): number {
  const pa = parseParts(a);
  const pb = parseParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function parseParts(v: string | undefined | null): number[] {
  if (!v) return [0, 0, 0];
  return v.split('.').map(s => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  });
}
