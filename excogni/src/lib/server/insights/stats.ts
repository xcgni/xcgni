// Pure statistics for the insights engine. No DB, no side effects - unit-testable.
// The whole point of this module is HONESTY GATES: turning raw session data into a claim
// only when the data actually supports it. Every function here is about "is this real, or noise?"

export interface Bucket {
  label: string;        // e.g. "7+ hours", "tired"
  values: number[];     // per-session performance values (mean score in [0,1]) for this bucket
}

export interface ComparisonResult {
  highLabel: string;
  lowLabel: string;
  highMean: number;
  lowMean: number;
  highN: number;
  lowN: number;
  relativeDiffPct: number;   // (high-low)/low * 100, the "X% better" number
  absoluteDiff: number;
  cohenD: number;            // standardized effect size
  pValue: number;            // Welch's t-test two-sided p
  passes: boolean;           // cleared all honesty gates?
  confidence: 'strong' | 'moderate' | null;
}

export interface InsightThresholds {
  minPerBucket: number;      // min sessions in EACH bucket compared
  minRelDiffPct: number;     // min relative difference to bother reporting
  minCohenD: number;         // min standardized effect size
  maxP: number;              // max p-value (significance)
  strongP: number;           // p below this AND strong effect => "strong" confidence
  strongCohenD: number;
}

// "Balanced" defaults: surface likely-real patterns, label confidence honestly.
export const BALANCED: InsightThresholds = {
  minPerBucket: 8,
  minRelDiffPct: 10,
  minCohenD: 0.4,
  maxP: 0.05,
  strongP: 0.01,
  strongCohenD: 0.8
};

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}

export function stdev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

// Welch's t-test (unequal variances). Returns the two-sided p-value via a normal approximation
// of the t-distribution - good enough for the n we deal with and avoids a stats dependency.
export function welchT(a: number[], b: number[]): { t: number; p: number } {
  const ma = mean(a), mb = mean(b);
  const va = variance(a), vb = variance(b);
  const na = a.length, nb = b.length;
  if (na < 2 || nb < 2) return { t: 0, p: 1 };
  const se = Math.sqrt(va / na + vb / nb);
  if (se === 0) return { t: 0, p: 1 };
  const t = (ma - mb) / se;
  // two-sided p via normal approximation (df is large-ish; conservative enough here)
  const p = 2 * (1 - normalCdf(Math.abs(t)));
  return { t, p: Math.max(0, Math.min(1, p)) };
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation).
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const prob = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - prob : prob;
}

// Cohen's d with pooled standard deviation - standardized effect size.
export function cohenD(a: number[], b: number[]): number {
  const na = a.length, nb = b.length;
  if (na < 2 || nb < 2) return 0;
  const pooledVar = ((na - 1) * variance(a) + (nb - 1) * variance(b)) / (na + nb - 2);
  const sd = Math.sqrt(pooledVar);
  if (sd === 0) return 0;
  return (mean(a) - mean(b)) / sd;
}

// Compare two buckets and decide - through the honesty gates - whether there's a reportable
// difference. Returns the high vs low framing (always "you do better in X than Y").
export function compareBuckets(b1: Bucket, b2: Bucket, th: InsightThresholds = BALANCED): ComparisonResult | null {
  if (b1.values.length < th.minPerBucket || b2.values.length < th.minPerBucket) return null;

  const m1 = mean(b1.values), m2 = mean(b2.values);
  const [high, low] = m1 >= m2 ? [b1, b2] : [b2, b1];
  const highMean = mean(high.values), lowMean = mean(low.values);
  if (lowMean === 0) return null;

  const relativeDiffPct = ((highMean - lowMean) / lowMean) * 100;
  const absoluteDiff = highMean - lowMean;
  const d = Math.abs(cohenD(high.values, low.values));
  const { p } = welchT(high.values, low.values);

  const passes =
    relativeDiffPct >= th.minRelDiffPct &&
    d >= th.minCohenD &&
    p <= th.maxP;

  let confidence: 'strong' | 'moderate' | null = null;
  if (passes) confidence = (p <= th.strongP && d >= th.strongCohenD) ? 'strong' : 'moderate';

  return {
    highLabel: high.label,
    lowLabel: low.label,
    highMean,
    lowMean,
    highN: high.values.length,
    lowN: low.values.length,
    relativeDiffPct,
    absoluteDiff,
    cohenD: d,
    pValue: p,
    passes,
    confidence
  };
}
