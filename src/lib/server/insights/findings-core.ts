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

export function cohensD(m1: number, sd1: number, n1: number, m2: number, sd2: number, n2: number): number {
  const pooled = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / Math.max(n1 + n2 - 2, 1));
  if (pooled === 0) return Math.abs(m1 - m2) >= 0.05 ? Math.sign(m1 - m2) * 0.5 : 0;
  return (m1 - m2) / pooled;
}

function pct(x: number): string {
  return `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
}

type Band = { band: string; n: number; mean: number; sd: number };

export function gateTimeOfDay(bands: Band[]): Finding {
  const id = 'time_of_day';
  const title = 'Time of day';
  const eligible = bands.filter((b) => b.n >= MIN_N_BAND);
  if (eligible.length < 2) {
    const have = bands.map((b) => `${b.band} ${Math.min(b.n, MIN_N_BAND)}/${MIN_N_BAND}`).join(', ');
    return {
      id, title, unlocked: false, effect: null,
      sentence: `Unlocks with ${MIN_N_BAND}+ answered items in at least two times of day.`,
      detail: have ? `So far: ${have}.` : 'No timed attempts yet.'
    };
  }
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.n, worst.mean, worst.sd, worst.n);
  if (Math.abs(d) < MIN_D) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: `No reliable time-of-day pattern: your ${sorted.map((b) => b.band).join(' and ')} scores are statistically indistinguishable.`,
      detail: `Compared ${eligible.map((b) => `${b.band} (n=${b.n})`).join(' vs ')}; effect below the reporting bar (|d| < ${MIN_D}). A boring result is still a result.`
    };
  }
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  return {
    id, title, unlocked: true, effect: d,
    sentence: `Your ${best.band} scores run ${pct(rel)} above your ${worst.band} scores.`,
    detail: `${best.band} mean ${best.mean.toFixed(2)} (n=${best.n}) vs ${worst.band} ${worst.mean.toFixed(2)} (n=${worst.n}), d=${d.toFixed(2)}. Association, not cause - scheduling, sleep and task mix all ride along.`
  };
}

type Curve = { category_slug: string; n: number; early_mean: number; late_mean: number };

export function gateLearningCurve(curves: Curve[]): Finding {
  const id = 'learning_curve';
  const title = 'Learning curve';
  const eligible = curves.filter((c) => c.n >= 40 && c.early_mean != null && c.late_mean != null);
  if (eligible.length === 0) {
    const closest = [...curves].sort((a, b) => b.n - a.n)[0];
    return {
      id, title, unlocked: false, effect: null,
      sentence: 'Unlocks with 40+ answered items in one area.',
      detail: closest ? `Closest: ${closest.category_slug.replace(/_/g, ' ')} at ${Math.min(closest.n, 40)}/40.` : 'Keep practicing - the curve needs history.'
    };
  }
  const steepest = [...eligible].sort(
    (a, b) => (b.late_mean - b.early_mean) - (a.late_mean - a.early_mean)
  )[0];
  const gain = steepest.late_mean - steepest.early_mean;
  const relGain = steepest.early_mean !== 0 ? gain / Math.abs(steepest.early_mean) : 0;
  const name = steepest.category_slug.replace(/_/g, ' ');
  if (gain <= 0.02) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: `Your practiced areas have plateaued: late-practice scores match your early ones.`,
      detail: `Largest change ${name}: ${steepest.early_mean.toFixed(2)} early vs ${steepest.late_mean.toFixed(2)} late (n=${steepest.n}). Plateaus are where the adaptive ladder earns its keep.`
    };
  }
  return {
    id, title, unlocked: true, effect: relGain,
    sentence: `${name}: your recent scores run ${pct(relGain)} above your first sessions.`,
    detail: `Early third ${steepest.early_mean.toFixed(2)} vs late third ${steepest.late_mean.toFixed(2)}, n=${steepest.n}. This is the PRACTICE EFFECT the methodology page warns about - familiarity plus ability, inseparable at this n. It is reported as improvement on the instrument, not certified cognitive gain.`
  };
}

type Pos = { bucket: string; n: number; mean: number; sd: number };

export function gatePosition(buckets: Pos[]): Finding {
  const id = 'session_position';
  const title = 'Within a session';
  const start = buckets.find((b) => b.bucket === 'start');
  const late = buckets.find((b) => b.bucket === 'late');
  if (!start || !late || start.n < MIN_N_BAND || late.n < MIN_N_BAND) {
    const s = start ? Math.min(start.n, MIN_N_BAND) : 0;
    const l = late ? Math.min(late.n, MIN_N_BAND) : 0;
    return {
      id, title, unlocked: false, effect: null,
      sentence: `Unlocks with ${MIN_N_BAND}+ items both early and late in sessions.`,
      detail: `So far: start ${s}/${MIN_N_BAND}, late-session ${l}/${MIN_N_BAND}. Longer sessions feed the late bucket.`
    };
  }
  const d = cohensD(late.mean, late.sd, late.n, start.mean, start.sd, start.n);
  if (Math.abs(d) < MIN_D) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: 'Your performance holds steady through a session - no warm-up or fatigue drift detected.',
      detail: `Start ${start.mean.toFixed(2)} (n=${start.n}) vs late ${late.mean.toFixed(2)} (n=${late.n}), |d| < ${MIN_D}. Steady is a finding too.`
    };
  }
  const rel = start.mean !== 0 ? (late.mean - start.mean) / Math.abs(start.mean) : 0;
  const direction = d > 0 ? 'rise' : 'dip';
  return {
    id, title, unlocked: true, effect: d,
    sentence: `Your scores ${direction} ${pct(Math.abs(rel) * Math.sign(rel))} late in a session compared to the start.`,
    detail: `Start ${start.mean.toFixed(2)} (n=${start.n}) vs late ${late.mean.toFixed(2)} (n=${late.n}), d=${d.toFixed(2)}. ${d > 0 ? 'A warm-up pattern.' : 'A fatigue-like pattern.'} The task mix within sessions rides along - association, not cause.`
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
  extraCaveat: string
): Finding {
  const eligible = bands.filter((b) => b.n >= MIN_N_BAND);
  if (eligible.length < 2) {
    const have = bands.map((b) => `${b.band} ${Math.min(b.n, MIN_N_BAND)}/${MIN_N_BAND}`).join(', ');
    return {
      id, title, unlocked: false, effect: null,
      sentence: `Unlocks with ${MIN_N_BAND}+ answered items on at least two kinds of ${noun} days.`,
      detail: have ? `So far: ${have}.` : `No ${noun}-tagged sessions yet - the pre-session question feeds this.`
    };
  }
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.n, worst.mean, worst.sd, worst.n);
  if (Math.abs(d) < MIN_D) {
    return {
      id, title, unlocked: true, effect: 0,
      sentence: `No reliable ${noun} pattern: your scores across ${sorted.map((b) => b.band).join(' and ')} days are statistically indistinguishable.`,
      detail: `Compared ${eligible.map((b) => `${b.band} (n=${b.n})`).join(' vs ')}; effect below the reporting bar (|d| < ${MIN_D}). A boring result is still a result.`
    };
  }
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  return {
    id, title, unlocked: true, effect: d,
    sentence: `Your scores on ${best.band} days run ${pct(rel)} above ${worst.band} days.`,
    detail: `${best.band}: mean ${best.mean.toFixed(2)} (n=${best.n}) vs ${worst.band}: ${worst.mean.toFixed(2)} (n=${worst.n}), d=${d.toFixed(2)}. ${extraCaveat}`
  };
}

export function gateSleep(bands: Band[]): Finding {
  return gatePersonalBands(
    'sleep', 'Sleep', 'sleep',
    bands,
    'Day-level association from your own pre-session answers, not cause - what you did that day, the task mix, and how honestly the hours were reported all ride along.'
  );
}

export function gateCaffeine(bands: Band[]): Finding {
  return gatePersonalBands(
    'caffeine', 'Caffeine', 'caffeine',
    bands,
    'Day-level association from your own pre-session answers, not cause - and caffeine choices often FOLLOW how a day already feels.'
  );
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

export function forecastFromBands(bands: Band[], nowHour: number): Forecast | null {
  const eligible = bands.filter((b) => b.n >= MIN_N_BAND);
  if (eligible.length < 2) return null;
  const sorted = [...eligible].sort((a, b) => b.mean - a.mean);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const d = cohensD(best.mean, best.sd, best.n, worst.mean, worst.sd, worst.n);
  if (Math.abs(d) < MIN_D) return null;

  const now = bandForHour(nowHour);
  const rel = worst.mean !== 0 ? (best.mean - worst.mean) / Math.abs(worst.mean) : 0;
  const detail = `Your own history: ${best.band} mean ${best.mean.toFixed(2)} (n=${best.n}) vs ${worst.band} ${worst.mean.toFixed(2)} (n=${worst.n}), d=${d.toFixed(2)}. Historical association, not a prediction.`;

  if (now === best.band) {
    return { line: `You are in what has historically been your strongest window (${best.band}s, ${pct(rel)} vs your ${worst.band}s).`, detail };
  }
  if (now === worst.band) {
    return { line: `Historically your quietest window: your ${worst.band} scores run ${pct(-rel)} vs your ${best.band}s. Data from any hour counts the same.`, detail };
  }
  return { line: `Historically, your strongest window is the ${best.band} (${pct(rel)} vs your ${worst.band}s).`, detail };
}

// v1.12.0 - tag findings: a tagged-days vs untagged-days comparison through the same
// band machinery. Day-grain fold (any session that day carried the tag), stated in the
// caveat so run-grain and day-grain claims never blur.
export function gateTagDays(id: string, title: string, tagLabel: string, bands: Band[]): Finding {
  return gatePersonalBands(
    id, title, tagLabel.toLowerCase(),
    bands,
    `Day-level fold: a day counts as "${tagLabel}" if ANY session that day carried the tag. Association from your own tagging, not cause - and what makes a day taggable often shapes the day itself.`
  );
}
