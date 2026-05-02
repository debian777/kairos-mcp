/** Normalize stored MIME for comparisons (lowercase, strip parameters). */
export function normalizeMimeType(raw: string): string {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return '';
  const semi = s.indexOf(';');
  return semi === -1 ? s : s.slice(0, semi).trim();
}
