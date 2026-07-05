// Statistical primitives for the admin tool. Dependency-free and testable.
// The discipline: every summary carries n and uncertainty; comparisons carry
// effect size; small groups are suppressed; exploratory slicing is flagged.

export interface Summary {
  n: number;
  mean: number | null;
  sd: number | null;
  ci95: [number, number] | null; // mean ± 1.96·SE
  median: number | null;
  iqr: [number, number] | null;  // 25th, 75th
  min: number | null;
  max: number | null;
}

export function summarize(values: number[]): Summary {
  const n = values.length;
  if (n === 0) return { n: 0, mean: null, sd: null, ci95: null, median: null, iqr: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const se = n > 1 ? sd / Math.sqrt(n) : 0;
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    n,
    mean: round(mean),
    sd: round(sd),
    ci95: n > 1 ? [round(mean - 1.96 * se), round(mean + 1.96 * se)] : null,
    median: round(q(0.5)),
    iqr: [round(q(0.25)), round(q(0.75))],
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}

export interface Comparison {
  groupA: Summary;
  groupB: Summary;
  meanDiff: number | null;
  cohensD: number | null;          // standardized effect size
  effectLabel: 'negligible' | 'small' | 'medium' | 'large' | null;
  // a rough two-sample z on the difference; NOT a substitute for a real test,
  // surfaced only as a directional signal alongside the effect size.
  zApprox: number | null;
  suppressed: boolean;
}

function effectLabel(d: number): Comparison['effectLabel'] {
  const a = Math.abs(d);
  if (a < 0.2) return 'negligible';
  if (a < 0.5) return 'small';
  if (a < 0.8) return 'medium';
  return 'large';
}

/** Compare two groups. Returns effect size first; the z is a weak directional aid. */
export function compare(a: number[], b: number[], minCell: number): Comparison {
  const ga = summarize(a);
  const gb = summarize(b);
  if (a.length < minCell || b.length < minCell || ga.mean == null || gb.mean == null) {
    return { groupA: ga, groupB: gb, meanDiff: null, cohensD: null, effectLabel: null, zApprox: null, suppressed: true };
  }
  const meanDiff = ga.mean - gb.mean;
  // pooled SD for Cohen's d
  const na = a.length, nb = b.length;
  const pooledVar = ((na - 1) * (ga.sd ?? 0) ** 2 + (nb - 1) * (gb.sd ?? 0) ** 2) / (na + nb - 2);
  const pooledSd = Math.sqrt(pooledVar);
  const d = pooledSd > 0 ? meanDiff / pooledSd : 0;
  const seDiff = Math.sqrt((ga.sd ?? 0) ** 2 / na + (gb.sd ?? 0) ** 2 / nb);
  const z = seDiff > 0 ? meanDiff / seDiff : 0;
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    groupA: ga, groupB: gb,
    meanDiff: r(meanDiff),
    cohensD: r(d),
    effectLabel: effectLabel(d),
    zApprox: r(z),
    suppressed: false
  };
}

/**
 * Multiple-comparisons warning. Given how many comparisons an exploratory view
 * implies, returns the chance at least one false "signal" appears at the naive
 * 0.05 level, plus a Bonferroni-adjusted threshold to use instead.
 */
export function multipleComparisons(numComparisons: number): {
  familywiseFalsePositiveRate: number;
  bonferroniThreshold: number;
  warn: boolean;
} {
  const m = Math.max(1, numComparisons);
  return {
    familywiseFalsePositiveRate: Math.round((1 - Math.pow(0.95, m)) * 100) / 100,
    bonferroniThreshold: Math.round((0.05 / m) * 10000) / 10000,
    warn: m >= 5
  };
}

/** Suppress a count cell below the minimum (anti-identification). */
export function suppressCount(n: number, minCell: number): number | null {
  return n >= minCell ? n : null;
}

/**
 * Intraclass-correlation-style test-retest reliability: given per-subject
 * repeated measurements, returns a 0..1 consistency estimate (between-subject
 * variance over total). High = the instrument ranks people consistently.
 */
export function testRetestReliability(perSubject: number[][]): { icc: number | null; subjects: number; ci95: [number, number] | null } {
  const groups = perSubject.filter((g) => g.length >= 2);
  const k = groups.length;
  if (k < 5) return { icc: null, subjects: k, ci95: null };
  const allVals = groups.flat();
  const grand = allVals.reduce((s, x) => s + x, 0) / allVals.length;
  const subjectMeans = groups.map((g) => g.reduce((s, x) => s + x, 0) / g.length);
  const between = subjectMeans.reduce((s, m) => s + (m - grand) ** 2, 0) / (k - 1);
  let withinSum = 0, withinN = 0;
  groups.forEach((g, i) => {
    g.forEach((x) => { withinSum += (x - subjectMeans[i]) ** 2; withinN += 1; });
  });
  const within = withinN > k ? withinSum / (withinN - k) : 0;
  const icc = between + within > 0 ? (between - within / 2) / (between + within) : 0;
  const iccClamped = Math.max(0, Math.min(1, icc));
  // approximate CI via Fisher-style SE on k subjects (rough, flagged as approximate)
  const se = Math.sqrt((1 - iccClamped ** 2) / Math.max(1, k - 2));
  const ci95: [number, number] = [
    Math.round(Math.max(0, iccClamped - 1.96 * se) * 100) / 100,
    Math.round(Math.min(1, iccClamped + 1.96 * se) * 100) / 100
  ];
  return { icc: Math.round(iccClamped * 100) / 100, subjects: k, ci95 };
}

/**
 * Benjamini-Hochberg false discovery rate. Given p-values, returns which are
 * significant at FDR q, and the adjusted threshold. Less conservative than
 * Bonferroni - the right default at modest sample sizes.
 */
export function benjaminiHochberg(pValues: number[], q = 0.05): { significant: boolean[]; threshold: number | null } {
  const m = pValues.length;
  if (m === 0) return { significant: [], threshold: null };
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let maxK = -1;
  for (let rank = 0; rank < m; rank++) {
    if (indexed[rank].p <= ((rank + 1) / m) * q) maxK = rank;
  }
  const threshold = maxK >= 0 ? indexed[maxK].p : null;
  const significant = new Array(m).fill(false);
  if (maxK >= 0) for (let rank = 0; rank <= maxK; rank++) significant[indexed[rank].i] = true;
  return { significant, threshold: threshold != null ? Math.round(threshold * 10000) / 10000 : null };
}

/**
 * Cliff's delta - a non-parametric effect size robust to skew and unequal
 * variance (cognitive scores are rarely normal, so report this beside Cohen's d).
 * Range -1..1; |delta| 0.11/0.28/0.43 ~ small/medium/large.
 */
export function cliffsDelta(a: number[], b: number[]): { delta: number | null; label: string | null } {
  if (a.length === 0 || b.length === 0) return { delta: null, label: null };
  let gt = 0, lt = 0;
  for (const x of a) for (const y of b) { if (x > y) gt++; else if (x < y) lt++; }
  const delta = (gt - lt) / (a.length * b.length);
  const ad = Math.abs(delta);
  const label = ad < 0.11 ? 'negligible' : ad < 0.28 ? 'small' : ad < 0.43 ? 'medium' : 'large';
  return { delta: Math.round(delta * 1000) / 1000, label };
}

/** Two-proportion comparison for consenter-vs-non-consenter bias on a shared
 *  binary/rate variable. Returns the gap and whether it's notable. */
export function proportionGap(consented: { yes: number; n: number }, nonConsented: { yes: number; n: number }): {
  consentedRate: number | null; nonConsentedRate: number | null; gap: number | null; notable: boolean;
} {
  if (consented.n < 20 || nonConsented.n < 20) {
    return { consentedRate: null, nonConsentedRate: null, gap: null, notable: false };
  }
  const cr = consented.yes / consented.n;
  const nr = nonConsented.yes / nonConsented.n;
  const gap = cr - nr;
  return {
    consentedRate: Math.round(cr * 1000) / 1000,
    nonConsentedRate: Math.round(nr * 1000) / 1000,
    gap: Math.round(gap * 1000) / 1000,
    notable: Math.abs(gap) >= 0.1
  };
}
