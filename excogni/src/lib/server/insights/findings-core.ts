/**
 * Findings core (v1.5.0) - pure gating and effect math, no database, directly testable.
 *
 * Design rules, enforced here so every finding obeys them:
 * - A finding UNLOCKS only past its statistical bar (min n per compared group AND a minimum
 *   effect size). Below the bar it reports exactly what is missing.
 * - Effect threshold: Cohen's d >= 0.25 for band comparisons (small-but-real), or an
 *   absolute score gap >= 0.05 where sds are degenerate. Deliberately conservative:
 *   an instrument that speaks rarely and correctly beats one that chatters.
 * - No causal language. "Your evening scores run lower" - never "you are worse because".
 * - Practice effects are NAMED as practice effects, never sold as ability gains.
 */

import { translate as tr, type Locale } from '../../i18n/index.ts';

export interface Finding {
  id: string;
  title: string;
  unlocked: boolean;
  sentence: string;      // the finding itself, or what unlocks it
  detail: string;        // n, effect, honesty note
  effect: number | null; // signed effect size when unlocked
}

const MIN_N_BAND = 30;
const MIN_D = 0.25;

type TrKey = Parameters<typeof tr>[1];
function T(locale: Locale, key: TrKey, params?: Record<string, string | number>) {
  return tr(locale, key, params);
}

export function cohensD(m1: number, sd1: number, n1: number, m2: number, sd2: number, n2: number): number {
  const pooled = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / Math.max(n1 + n2 - 2, 1));
  if (pooled === 0) return Math.abs(m1 - m2) >= 0.05 ? Math.sign(m1 - m2) * 0.5 : 0;
  return (m1 - m2) / pooled;
}

function pct(x: number): string {
  return `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
}

type Band = { band: string; n: number; mean: number; sd: number };

export function gateTimeOfDay(bands: Band[], locale: Locale = 'en'): Finding {
  const id = 'time_of_day';
  const title = T(locale, 'find.tod.title');
  const bandName = (b: string) => T(locale, ('band.' + b) as TrKey);
  const eligible = bands.filter((b) => b.n >= MIN_N_BAND);
  if (eligible.length < 2) {
    const have = bands.map((b) => `${bandName(b.band)} ${Math.min(b.n, MIN_N_BAND)}/${MIN_N_BAND}`).join(', ');
    return {
      id, title, unlocked: false, effect: null,
      sentence: T(locale, 'find.tod.locked', { n: MIN_N_BAND }),
      detail: have ? T(locale, 'find.soFar', { have }) : T(locale, 'find.tod.none')
    };
  }
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.n, worst.mean, worst.sd, worst.n);
  if (Math.abs(d) < MIN_D) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: T(locale, 'find.tod.null', { bands: sorted.map((b) => bandName(b.band)).join(' / ') }),
      detail: T(locale, 'find.null.detail', { compared: eligible.map((b) => `${bandName(b.band)} (n=${b.n})`).join(' vs '), minD: MIN_D })
    };
  }
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  return {
    id, title, unlocked: true, effect: d,
    sentence: T(locale, 'find.tod.hit', { best: bandName(best.band), worst: bandName(worst.band), pct: pct(rel) }),
    detail: T(locale, 'find.tod.detail', { best: bandName(best.band), bm: best.mean.toFixed(2), bn: best.n, worst: bandName(worst.band), wm: worst.mean.toFixed(2), wn: worst.n, d: d.toFixed(2) })
  };
}

type Curve = { category_slug: string; n: number; early_mean: number; late_mean: number };

export function gateLearningCurve(curves: Curve[], locale: Locale = 'en', catName?: (slug: string) => string): Finding {
  const id = 'learning_curve';
  const title = T(locale, 'find.curve.title');
  const nameOf = (slug: string) => (catName ? catName(slug) : slug.replace(/_/g, ' '));
  const eligible = curves.filter((c) => c.n >= 40 && c.early_mean != null && c.late_mean != null);
  if (eligible.length === 0) {
    const closest = [...curves].sort((a, b) => b.n - a.n)[0];
    return {
      id, title, unlocked: false, effect: null,
      sentence: T(locale, 'find.curve.locked'),
      detail: closest
        ? T(locale, 'find.curve.closest', { name: nameOf(closest.category_slug), have: Math.min(closest.n, 40) })
        : T(locale, 'find.curve.none')
    };
  }
  const steepest = [...eligible].sort(
    (a, b) => (b.late_mean - b.early_mean) - (a.late_mean - a.early_mean)
  )[0];
  const gain = steepest.late_mean - steepest.early_mean;
  const relGain = steepest.early_mean !== 0 ? gain / Math.abs(steepest.early_mean) : 0;
  const name = nameOf(steepest.category_slug);
  if (gain <= 0.02) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: T(locale, 'find.curve.plateau'),
      detail: T(locale, 'find.curve.plateauDetail', { name, em: steepest.early_mean.toFixed(2), lm: steepest.late_mean.toFixed(2), n: steepest.n })
    };
  }
  return {
    id, title, unlocked: true, effect: relGain,
    sentence: T(locale, 'find.curve.hit', { name, pct: pct(relGain) }),
    detail: T(locale, 'find.curve.detail', { em: steepest.early_mean.toFixed(2), lm: steepest.late_mean.toFixed(2), n: steepest.n })
  };
}

type Pos = { bucket: string; n: number; mean: number; sd: number };

export function gatePosition(buckets: Pos[], locale: Locale = 'en'): Finding {
  const id = 'session_position';
  const title = T(locale, 'find.pos.title');
  const start = buckets.find((b) => b.bucket === 'start');
  const late = buckets.find((b) => b.bucket === 'late');
  if (!start || !late || start.n < MIN_N_BAND || late.n < MIN_N_BAND) {
    const sN = start ? Math.min(start.n, MIN_N_BAND) : 0;
    const lN = late ? Math.min(late.n, MIN_N_BAND) : 0;
    return {
      id, title, unlocked: false, effect: null,
      sentence: T(locale, 'find.pos.locked', { n: MIN_N_BAND }),
      detail: T(locale, 'find.pos.progress', { s: sN, l: lN, n: MIN_N_BAND })
    };
  }
  const d = cohensD(late.mean, late.sd, late.n, start.mean, start.sd, start.n);
  if (Math.abs(d) < MIN_D) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: T(locale, 'find.pos.steady'),
      detail: T(locale, 'find.pos.steadyDetail', { sm: start.mean.toFixed(2), sn: start.n, lm: late.mean.toFixed(2), ln: late.n, minD: MIN_D })
    };
  }
  const rel = start.mean !== 0 ? (late.mean - start.mean) / Math.abs(start.mean) : 0;
  return {
    id, title, unlocked: true, effect: d,
    sentence: T(locale, d > 0 ? 'find.pos.rise' : 'find.pos.dip', { pct: pct(Math.abs(rel) * Math.sign(rel)) }),
    detail: T(locale, 'find.pos.detail', { sm: start.mean.toFixed(2), sn: start.n, lm: late.mean.toFixed(2), ln: late.n, d: d.toFixed(2), pattern: T(locale, d > 0 ? 'find.pos.warmup' : 'find.pos.fatigue') })
  };
}

// ---------------------------------------------------------------------------
// v1.8.0 - context findings (J5): the same band machinery, generalized, applied
// to self-reported context (sleep, caffeine) paired with same-day scores.
// Day-level association ONLY, and the wording says so.
// ---------------------------------------------------------------------------

export function gatePersonalBands(
  id: string,
  title: string,
  noun: string,
  bands: Band[],
  extraCaveat: string,
  locale: Locale = 'en'
): Finding {
  const eligible = bands.filter((b) => b.n >= MIN_N_BAND);
  if (eligible.length < 2) {
    const have = bands.map((b) => `${b.band} ${Math.min(b.n, MIN_N_BAND)}/${MIN_N_BAND}`).join(', ');
    return {
      id, title, unlocked: false, effect: null,
      sentence: T(locale, 'find.days.locked', { n: MIN_N_BAND, noun }),
      detail: have ? T(locale, 'find.soFar', { have }) : T(locale, 'find.days.none', { noun })
    };
  }
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.n, worst.mean, worst.sd, worst.n);
  if (Math.abs(d) < MIN_D) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: T(locale, 'find.days.null', { noun, bands: sorted.map((b) => b.band).join(' / ') }),
      detail: T(locale, 'find.null.detail', { compared: eligible.map((b) => `${b.band} (n=${b.n})`).join(' vs '), minD: MIN_D })
    };
  }
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  return {
    id, title, unlocked: true, effect: d,
    sentence: T(locale, 'find.days.hit', { best: best.band, worst: worst.band, pct: pct(rel) }),
    detail: T(locale, 'find.days.detail', { best: best.band, bm: best.mean.toFixed(2), bn: best.n, worst: worst.band, wm: worst.mean.toFixed(2), wn: worst.n, d: d.toFixed(2) }) + ' ' + extraCaveat
  };
}

export function gateSleep(bands: Band[], locale: Locale = 'en'): Finding {
  return gatePersonalBands('sleep', T(locale, 'find.sleep.title'), T(locale, 'find.sleep.noun'), bands, T(locale, 'find.sleep.caveat'), locale);
}

export function gateCaffeine(bands: Band[], locale: Locale = 'en'): Finding {
  return gatePersonalBands('caffeine', T(locale, 'find.caffeine.title'), T(locale, 'find.caffeine.noun'), bands, T(locale, 'find.caffeine.caveat'), locale);
}

// ---------------------------------------------------------------------------
// v1.9.0 - the cognitive weather report (J1): findings turned prospective, but
// worded strictly HISTORICALLY. Reuses the exact time-of-day gates; if the
// finding would not unlock, the forecast is SILENCE - no line at all. An
// instrument that speaks rarely and correctly beats one that chatters.
// ---------------------------------------------------------------------------

export interface Forecast {
  line: string;
  detail: string;
}

export function bandForHour(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  return 'evening';
}

export function forecastFromBands(bands: Band[], nowHour: number, locale: Locale = 'en'): Forecast | null {
  const eligible = bands.filter((b) => b.n >= MIN_N_BAND);
  if (eligible.length < 2) return null;
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.n, worst.mean, worst.sd, worst.n);
  if (Math.abs(d) < MIN_D) return null;

  const now = bandForHour(nowHour);
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  const bandName = (b: string) => T(locale, ('band.' + b) as TrKey);
  const detail = T(locale, 'weather.detail', { best: bandName(best.band), bm: best.mean.toFixed(2), bn: best.n, worst: bandName(worst.band), wm: worst.mean.toFixed(2), wn: worst.n, d: d.toFixed(2) });

  if (now === best.band) {
    return { line: T(locale, 'weather.inBest', { best: bandName(best.band), worst: bandName(worst.band), pct: pct(rel) }), detail };
  }
  if (now === worst.band) {
    return { line: T(locale, 'weather.inWorst', { best: bandName(best.band), worst: bandName(worst.band), pct: pct(-rel) }), detail };
  }
  return { line: T(locale, 'weather.neutral', { best: bandName(best.band), worst: bandName(worst.band), pct: pct(rel) }), detail };
}

// v1.12.0 - tag findings: a tagged-days vs untagged-days comparison through the same
// band machinery. Day-grain fold (any session that day carried the tag), stated in the
// caveat so run-grain and day-grain claims never blur.
export function gateTagDays(id: string, title: string, tagLabel: string, bands: Band[], locale: Locale = 'en'): Finding {
  return gatePersonalBands(id, title, tagLabel.toLowerCase(), bands, T(locale, 'find.tag.caveat', { tag: tagLabel }), locale);
}
