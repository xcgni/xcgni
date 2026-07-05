import { pg } from '$lib/server/db';
import { adminConfig } from '$lib/server/flags';
import { compareBuckets, mean, BALANCED, type Bucket, type ComparisonResult } from './stats';

// One day of a user's practice: their mean performance that day + the context they logged.
interface DaySession {
  localDate: string;
  perf: number;            // mean attempt score in [0,1] that day
  sleepHours: number | null;
  rested: string | null;
  caffeine: string | null;
  otherStimulant: boolean | null;
  alertness: string | null;
  mood: string | null;
  napped: boolean | null;
  hour: number | null;     // typical local hour of that day's practice
  tags: string[] | null;   // self-tracking tags logged that day (union across the day's sessions)
}

export interface Insight {
  id: string;              // stable key for this insight type (so UI can de-dupe/animate)
  factor: 'sleep' | 'rested' | 'caffeine' | 'stimulant' | 'alertness' | 'mood' | 'nap' | 'time' | 'gap' | 'tag' | 'schedule';
  text: string;            // the honest, correlational sentence
  confidence: 'strong' | 'moderate';
  basis: string;           // "based on 23 sessions" - transparency
  relativeDiffPct: number;
  vsPopulation?: boolean;  // true if this is a you-vs-everyone insight
}

export interface InsightsResult {
  state: 'not_enough_data' | 'no_patterns' | 'ok';
  minSessions: number;
  sessionCount: number;
  insights: Insight[];
}

// (Removed the old global MIN_TOTAL_SESSIONS=20 gate: insights now unlock individually as each one's
// own evidence threshold is met, rather than all-or-nothing at a fixed session count.)

// Pull each day's mean performance + that day's logged context.
// NOTE: session_context.local_date is a DATE column in the DB (the migration created it as
// `date`, even though the Drizzle schema labels it text). attempts has no local_date, so we
// derive one as text via to_char. To join them we compare both as text (cast the date side).
async function userDays(userId: string): Promise<DaySession[]> {
  const rows = await pg`
    SELECT a.local_date AS "localDate",
           avg(a.score)::float AS perf,
           max(sc.sleep_hours) AS "sleepHours",
           max(sc.rested) AS rested,
           max(sc.caffeine) AS caffeine,
           bool_or(sc.other_stimulant) AS "otherStimulant",
           max(sc.alertness) AS alertness,
           max(sc.mood) AS mood,
           bool_or(sc.napped) AS napped,
           round(avg(a.local_hour))::int AS hour,
           max(tg.tags) AS tags
    FROM (
      SELECT *, to_char(served_at, 'YYYY-MM-DD') AS local_date FROM attempts WHERE user_id = ${userId} AND score IS NOT NULL
    ) a
    LEFT JOIN session_context sc ON sc.user_id = ${userId} AND sc.local_date::text = a.local_date
    LEFT JOIN (
      SELECT s2.local_date::text AS ld, array_agg(DISTINCT t) AS tags
      FROM session_context s2, unnest(s2.tags) AS t
      WHERE s2.user_id = ${userId}
      GROUP BY s2.local_date
    ) tg ON tg.ld = a.local_date
    GROUP BY a.local_date
    HAVING count(*) >= 3
    ORDER BY a.local_date
  `;
  return rows as DaySession[];
}

// --- bucketers: split days into labelled buckets by a context factor ---

function bucketBySleep(days: DaySession[]): [Bucket, Bucket] | null {
  const withSleep = days.filter((d) => d.sleepHours != null);
  if (withSleep.length < 10) return null;
  const low = withSleep.filter((d) => (d.sleepHours as number) < 6.5).map((d) => d.perf);
  const high = withSleep.filter((d) => (d.sleepHours as number) >= 7).map((d) => d.perf);
  return [{ label: '7+ hours of sleep', values: high }, { label: 'under 6.5 hours', values: low }];
}

function bucketByCaffeine(days: DaySession[]): [Bucket, Bucket] | null {
  const some = days.filter((d) => d.caffeine === 'some' || d.caffeine === 'lots').map((d) => d.perf);
  const none = days.filter((d) => d.caffeine === 'none').map((d) => d.perf);
  if (some.length === 0 || none.length === 0) return null;
  return [{ label: 'with caffeine', values: some }, { label: 'without caffeine', values: none }];
}

function bucketByAlertness(days: DaySession[]): [Bucket, Bucket] | null {
  const wired = days.filter((d) => d.alertness === 'wired' || d.alertness === 'ok').map((d) => d.perf);
  const tired = days.filter((d) => d.alertness === 'tired').map((d) => d.perf);
  if (wired.length === 0 || tired.length === 0) return null;
  return [{ label: 'feeling alert', values: wired }, { label: 'feeling tired', values: tired }];
}

function bucketByMood(days: DaySession[]): [Bucket, Bucket] | null {
  const good = days.filter((d) => d.mood === 'good').map((d) => d.perf);
  const low = days.filter((d) => d.mood === 'low').map((d) => d.perf);
  if (good.length === 0 || low.length === 0) return null;
  return [{ label: 'good mood', values: good }, { label: 'low mood', values: low }];
}

function bucketByNap(days: DaySession[]): [Bucket, Bucket] | null {
  const napped = days.filter((d) => d.napped === true).map((d) => d.perf);
  const not = days.filter((d) => d.napped === false).map((d) => d.perf);
  if (napped.length === 0 || not.length === 0) return null;
  return [{ label: 'after a nap', values: napped }, { label: 'without a nap', values: not }];
}

function bucketByTime(days: DaySession[]): [Bucket, Bucket] | null {
  const withHour = days.filter((d) => d.hour != null);
  if (withHour.length < 10) return null;
  const morning = withHour.filter((d) => (d.hour as number) < 12).map((d) => d.perf);
  const evening = withHour.filter((d) => (d.hour as number) >= 17).map((d) => d.perf);
  if (morning.length === 0 || evening.length === 0) return null;
  return [{ label: 'in the morning', values: morning }, { label: 'in the evening', values: evening }];
}

function bucketByRested(days: DaySession[]): [Bucket, Bucket] | null {
  const good = days.filter((d) => d.rested === 'good').map((d) => d.perf);
  const poor = days.filter((d) => d.rested === 'poor').map((d) => d.perf);
  if (good.length === 0 || poor.length === 0) return null;
  return [{ label: 'feeling well-rested', values: good }, { label: 'feeling unrested', values: poor }];
}

function bucketByStimulant(days: DaySession[]): [Bucket, Bucket] | null {
  const on = days.filter((d) => d.otherStimulant === true).map((d) => d.perf);
  const off = days.filter((d) => d.otherStimulant === false).map((d) => d.perf);
  if (on.length === 0 || off.length === 0) return null;
  return [{ label: 'with another stimulant', values: on }, { label: 'without', values: off }];
}

// Weekday vs weekend: purely from the local date, no logging needed. Same evidence gates as
// every other bucketer (>=4 days per side, effect + significance via compareBuckets).
function bucketBySchedule(days: DaySession[]): [Bucket, Bucket] | null {
  const wk: number[] = [], we: number[] = [];
  for (const d of days) {
    const dow = new Date(d.localDate + 'T12:00:00Z').getUTCDay();
    (dow === 0 || dow === 6 ? we : wk).push(d.perf);
  }
  if (wk.length < 4 || we.length < 4) return null;
  return [{ label: 'on weekdays', values: wk }, { label: 'on weekends', values: we }];
}

const BUCKETERS: { factor: Insight['factor']; fn: (d: DaySession[]) => [Bucket, Bucket] | null }[] = [
  { factor: 'sleep', fn: bucketBySleep },
  { factor: 'rested', fn: bucketByRested },
  { factor: 'alertness', fn: bucketByAlertness },
  { factor: 'caffeine', fn: bucketByCaffeine },
  { factor: 'stimulant', fn: bucketByStimulant },
  { factor: 'mood', fn: bucketByMood },
  { factor: 'nap', fn: bucketByNap },
  { factor: 'time', fn: bucketByTime },
  { factor: 'schedule', fn: bucketBySchedule }
];

function sentence(factor: Insight['factor'], c: ComparisonResult): string {
  const pct = Math.round(c.relativeDiffPct);
  // Always correlational wording - "tend to", "when you've reported" - never causal.
  return `You tend to perform about ${pct}% better ${c.highLabel} than ${c.lowLabel}.`;
}

/**
 * Personal insights: within-user comparisons of performance across logged context.
 * Every insight has cleared the honesty gates (enough data per bucket, large enough effect,
 * statistically distinguishable from noise). Correlational wording only. Recomputed each call,
 * so an insight that no longer holds simply stops appearing.
 */
export async function userInsights(userId: string): Promise<InsightsResult> {
  const days = await userDays(userId);

  // Insights unlock AS THEY BECOME VALID, not at an arbitrary global day count. Each insight below
  // already self-gates on its own evidence (enough days per bucket, large enough effect,
  // distinguishable from noise), so we only need a minimal floor here: a bucket comparison is
  // meaningless with almost no history. Above that floor, any insight that individually clears its
  // bar appears; the rest simply don't yet. This replaces the old hard "20 sessions or nothing" wall
  // that suppressed insights which were already statistically sound.
  const MIN_FLOOR = 5; // need at least a handful of days for any two-bucket split to mean anything
  if (days.length < MIN_FLOOR) {
    return { state: 'not_enough_data', minSessions: MIN_FLOOR, sessionCount: days.length, insights: [] };
  }

  const insights: Insight[] = [];
  for (const { factor, fn } of BUCKETERS) {
    const buckets = fn(days);
    if (!buckets) continue;
    const c = compareBuckets(buckets[0], buckets[1], BALANCED);
    if (!c || !c.passes || !c.confidence) continue;
    insights.push({
      id: `personal:${factor}`,
      factor,
      text: sentence(factor, c),
      confidence: c.confidence,
      basis: `based on ${c.highN + c.lowN} sessions`,
      relativeDiffPct: c.relativeDiffPct
    });
  }

  // TAG-DRIVEN insights: the self-tracking tags people log (exercised, poor sleep, stressed,
  // fasting, ...) finally get mined. For each tag with enough days on BOTH sides (tagged vs not),
  // run the same honest comparison machinery as every other insight. Correlational wording only,
  // capped to the strongest few so a heavy tagger isn't flooded.
  {
    const tagDays = new Map<string, number[]>();
    const allPerf: { perf: number; tags: Set<string> }[] = days.map((d) => ({ perf: d.perf, tags: new Set(d.tags ?? []) }));
    for (const d of days) for (const t of d.tags ?? []) {
      if (!tagDays.has(t)) tagDays.set(t, []);
    }
    const tagInsights: Insight[] = [];
    for (const [tag] of tagDays) {
      const tagged = allPerf.filter((d) => d.tags.has(tag)).map((d) => d.perf);
      const untagged = allPerf.filter((d) => !d.tags.has(tag)).map((d) => d.perf);
      if (tagged.length < 4 || untagged.length < 4) continue;
      const c = compareBuckets(
        { label: `on days you tagged "${tag}"`, values: tagged },
        { label: 'on days you didn\'t', values: untagged },
        BALANCED
      );
      if (!c || !c.passes || !c.confidence) continue;
      tagInsights.push({
        id: `personal:tag:${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        factor: 'tag',
        text: sentence('tag', c),
        confidence: c.confidence,
        basis: `based on ${c.highN + c.lowN} sessions`,
        relativeDiffPct: c.relativeDiffPct
      });
    }
    // strongest few only
    tagInsights.sort((a, b) => Math.abs(b.relativeDiffPct) - Math.abs(a.relativeDiffPct));
    insights.push(...tagInsights.slice(0, 3));
  }

  // Population comparison (you vs everyone), only where there's enough consented population
  // data in the SAME context bucket to be fair. Appended after personal insights.
  try {
    const pop = await populationInsights(userId, days);
    insights.push(...pop);
  } catch {
    // population data optional - never block personal insights on it
  }

  // Skip-gap insight (LONG-TERM users only): does returning after a break of several days
  // relate to performance? Strictly descriptive and bidirectional - some people come back
  // rusty, some refreshed; we report whichever is true, never "don't skip days".
  const gapInsight = gapEffect(days);
  if (gapInsight) insights.push(gapInsight);

  // Avoidance patterns: skips are measurements too. A category skipped 3+ times, with 60%+ of
  // the skips concentrated in one part of the day, is a pattern worth naming - named as a
  // pattern, never a verdict.
  const skips = await pg`
    SELECT category_slug,
           count(*)::int AS n,
           count(*) FILTER (WHERE local_hour BETWEEN 5 AND 11)::int AS morning,
           count(*) FILTER (WHERE local_hour BETWEEN 12 AND 17)::int AS afternoon,
           count(*) FILTER (WHERE local_hour BETWEEN 18 AND 22)::int AS evening,
           count(*) FILTER (WHERE local_hour >= 23 OR local_hour <= 4)::int AS night
    FROM attempts
    WHERE user_id = ${userId} AND status = 'skipped' AND local_hour IS NOT NULL
    GROUP BY category_slug
    HAVING count(*) >= 3
    ORDER BY count(*) DESC
    LIMIT 2
  `;
  if (skips.length) {
    // Conjoin the skips with the user's own ratings: avoidance of a WEAK domain earns a plain
    // recommendation (growth lives exactly there); avoidance of a STRONG one reads as boredom.
    // Claims stay within the data: no daypart-performance interactions (those cells are thin) -
    // daypart appears only as the observed concentration of the skips themselves.
    const myRatings = await pg`
      SELECT category_slug, rating FROM user_category_state
      WHERE user_id = ${userId} AND attempts_count >= 10
    `;
    const rmap = new Map(myRatings.map((r: { category_slug: string; rating: number }) => [r.category_slug, Number(r.rating)]));
    const vals = [...rmap.values()];
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    for (const r of skips) {
      const parts: [string, number][] = [['the morning', r.morning], ['the afternoon', r.afternoon], ['the evening', r.evening], ['late hours', r.night]];
      parts.sort((a, b) => b[1] - a[1]);
      const when = parts[0][0];
      const k = parts[0][1];
      const concentrated = k / r.n >= 0.6;
      const name = String(r.category_slug).replace(/-/g, ' ');
      const rating = rmap.get(r.category_slug);
      const whenClause = concentrated ? `, mostly in ${when} (${k} of ${r.n})` : ` (${r.n} times, spread across hours)`;

      if (avg != null && rating != null && rating <= avg - 80) {
        insights.push({
          kind: 'avoidance',
          text: `You skip ${name} more than anything else${whenClause} - and it's also where your rating sits lowest relative to your own average. Avoidance and weakness pointing at the same spot. Plain recommendation: double down - put ${name} first in a session while you're fresh; that's where the next points live.`
        });
      } else if (avg != null && rating != null && rating >= avg + 40) {
        insights.push({
          kind: 'avoidance',
          text: `You often skip ${name}${whenClause}, yet it's one of your stronger domains - that reads as boredom, not difficulty. "Show less often" fits it better than skipping; the ladder will keep it honest either way.`
        });
      } else if (concentrated) {
        insights.push({
          kind: 'avoidance',
          text: `You tend to skip ${name} in ${when} - ${k} of ${r.n} skips. A pattern, not a verdict; maybe just not that domain's hour.`
        });
      } else {
        insights.push({
          kind: 'avoidance',
          text: `You've skipped ${name} ${r.n} times across different hours - if it's dread rather than mood, "show less often" or the Practice toggle fits better.`
        });
      }
    }
  }

  // strongest first
  insights.sort((a, b) => b.relativeDiffPct - a.relativeDiffPct);

  return {
    state: insights.length > 0 ? 'ok' : 'no_patterns',
    minSessions: MIN_FLOOR,
    sessionCount: days.length,
    insights
  };
}

// Compare performance on days that FOLLOW a gap (>=3 days since last practice) vs days that
// follow recent practice (<=1 day). Needs a long history, so the bar is higher than other
// insights. Bidirectional: reports "better" or "lower" honestly, with correlational wording.
const GAP_MIN_DAYS_HISTORY = 40; // long-term users only
function gapEffect(days: DaySession[]): Insight | null {
  if (days.length < GAP_MIN_DAYS_HISTORY) return null;

  const dayMs = 24 * 3600 * 1000;
  const afterGap: number[] = [];
  const afterRecent: number[] = [];
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1].localDate + 'T00:00:00Z').getTime();
    const cur = new Date(days[i].localDate + 'T00:00:00Z').getTime();
    const gap = Math.round((cur - prev) / dayMs);
    if (gap >= 3) afterGap.push(days[i].perf);
    else if (gap <= 1) afterRecent.push(days[i].perf);
  }

  const c = compareBuckets(
    { label: 'after a break of 3+ days', values: afterGap },
    { label: 'when practising regularly', values: afterRecent },
    BALANCED
  );
  if (!c || !c.passes || !c.confidence) return null;

  // figure out which side "after a gap" landed on, for honest directional wording
  const gapIsHigh = c.highLabel.startsWith('after a break');
  const pct = Math.round(c.relativeDiffPct);
  const text = gapIsHigh
    ? `When you return after a break of 3+ days, you tend to perform about ${pct}% better than when practising daily - a rest may suit you.`
    : `When you return after a break of 3+ days, you tend to perform about ${pct}% lower than when practising regularly.`;

  return {
    id: 'personal:gap',
    factor: 'gap',
    text,
    confidence: c.confidence,
    basis: `based on ${c.highN + c.lowN} return days`,
    relativeDiffPct: c.relativeDiffPct
  };
}

// How many consented people's days we need in a population bucket before comparing against it.
const POP_MIN = 50;

// You-vs-everyone: does the user out/under-perform the consented population WITHIN the same
// context? e.g. "on under 6.5h sleep, you score X% above the typical person in that state."
// Conservative: needs the public floor of population days in the bucket, and a sizable gap.
async function populationInsights(userId: string, days: DaySession[]): Promise<Insight[]> {
  const out: Insight[] = [];

  // Only attempt the most robust, clearly-defined buckets for the population comparison.
  const lowSleep = days.filter((d) => d.sleepHours != null && (d.sleepHours as number) < 6.5).map((d) => d.perf);
  if (lowSleep.length >= 10) {
    const popRows = await pg`
      SELECT avg(perf)::float AS m, count(*)::int AS n FROM (
        SELECT a.user_id, to_char(a.served_at,'YYYY-MM-DD') AS d, avg(a.score)::float AS perf
        FROM attempts a
        JOIN users u ON u.id = a.user_id
        JOIN user_attributes ua ON ua.user_id = u.id
        JOIN session_context sc ON sc.user_id = a.user_id AND sc.local_date::text = to_char(a.served_at,'YYYY-MM-DD')
        WHERE ua.consented_stats = true AND u.is_anonymous = false AND u.is_test = false
          AND a.score IS NOT NULL AND a.user_id <> ${userId}
          AND sc.sleep_hours IS NOT NULL AND sc.sleep_hours < 6.5
        GROUP BY a.user_id, d
      ) q
    `;
    const popM = (popRows as { m: number | null; n: number }[])[0]?.m;
    const popN = (popRows as { m: number | null; n: number }[])[0]?.n ?? 0;
    if (popM != null && popN >= POP_MIN) {
      const youM = mean(lowSleep);
      const rel = ((youM - popM) / popM) * 100;
      if (Math.abs(rel) >= 15) {
        const better = rel > 0;
        out.push({
          id: 'population:sleep_low',
          factor: 'sleep',
          text: `On under 6.5 hours of sleep, you tend to perform about ${Math.abs(Math.round(rel))}% ${better ? 'better' : 'lower'} than the typical person in the same state.`,
          confidence: 'moderate',
          basis: `vs ${popN} community sessions`,
          relativeDiffPct: Math.abs(rel),
          vsPopulation: true
        });
      }
    }
  }

  return out;
}
