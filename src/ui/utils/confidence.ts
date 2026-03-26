export function toConfidencePercent(score: number | null | undefined): number {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(score, 1)) * 100);
}
