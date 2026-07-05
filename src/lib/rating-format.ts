// Client-safe formatting helpers (no server imports). Mirrors the wording
// rules in src/lib/server/rating so the UI stays consistent.

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function percentileWording(percentile: number): string {
  return `${ordinal(percentile)} percentile · higher than ${percentile}% of rated users`;
}

export function fmtDelta(d: number | null): string {
  if (d == null) return '\u2014';
  return (d > 0 ? '+' : '') + d;
}
