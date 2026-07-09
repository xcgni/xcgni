import { pg } from '$lib/server/db';
import { editDistance } from '$lib/server/text/match';
import { flags, MIN_POOL_FOR_PERCENTILE, adminConfig } from '$lib/server/flags';
import { percentileOf, confidence, standardError, type Confidence } from '$lib/server/rating';

/**
 * The rating pool. Hard rules, enforced in the query rather than by deletion:
 *  - anonymous users never enter the pool
 *  - test users never enter the pool
 *  - simulated users enter ONLY while ENABLE_SIMULATED_USERS=true
 *  - a user needs >= 10 attempts in the category to be pool-eligible
 */
async function ratingPool(categorySlug: string): Promise<number[]> {
  const includeSim = flags.simulatedUsers();
  const rows = await pg`
    SELECT s.rating
    FROM user_category_state s
    JOIN users u ON u.id = s.user_id
    WHERE s.category_slug = ${categorySlug}
      AND s.attempts_count >= 10
      AND u.is_anonymous = false
      AND u.is_test = false
      AND (u.is_simulated = false OR ${includeSim})
  `;
  return rows.map((r: { rating: number }) => r.rating);
}

export interface PercentileResult {
  percentile: number | null;
  poolSize: number;
  aboveCount?: number | null;
  // Baseline-vs-now split: your FIRST calibrated global rating against everyone's first
  // (test-naive vs test-naive, like a real norming sample), plus the improvement since.
  baseline?: { rating: number; percentile: number | null; poolSize: number; aboveCount: number | null } | null;
  improvement?: { points: number; poolMedianPoints: number | null; poolN: number } | null;
  status: 'ok' | 'calibrating';
}

export async function categoryPercentile(categorySlug: string, rating: number): Promise<PercentileResult> {
  const pool = await ratingPool(categorySlug);
  if (rating <= 0) return { percentile: null, poolSize: pool.length, status: 'calibrating' };
  const pct = percentileOf(rating, pool, MIN_POOL_FOR_PERCENTILE);
  return { percentile: pct, poolSize: pool.length, status: pct == null ? 'calibrating' : 'ok' };
}

export interface CategoryRatingView {
  slug: string;
  name: string;
  domain: string;
  implemented: boolean;
  rating: number | null;
  percentile: number | null;
  poolSize: number;
  status: 'ok' | 'calibrating' | 'unrated';
  confidence: Confidence | null;
  provisional: boolean;
  attempts: number;
  stableLevel: number | null;
  delta7d: number | null;
  sem: number | null;
}

export interface GlobalRatingView {
  rating: number | null;
  percentile: number | null;
  poolSize: number;
  status: 'ok' | 'calibrating' | 'unrated';
  confidence: Confidence | null;
  provisional: boolean;
  delta7d: number | null;
  sem: number | null;
  categoriesRated?: number;
  categoriesNeeded?: number;
}

async function categoryDelta(userId: string, categorySlug: string, days = 7): Promise<number | null> {
  const rows = await pg`
    SELECT rating FROM rating_history
    WHERE user_id = ${userId} AND category_slug = ${categorySlug}
      AND recorded_at <= now() - (${String(days)} || ' days')::interval
    ORDER BY recorded_at DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  const past = rows[0].rating as number;
  const cur = await pg`
    SELECT rating FROM user_category_state
    WHERE user_id = ${userId} AND category_slug = ${categorySlug}
  `;
  if (cur.length === 0) return null;
  return (cur[0].rating as number) - past;
}

export async function userRatings(userId: string): Promise<{
  categories: CategoryRatingView[];
  global: GlobalRatingView;
}> {
  const cats = await pg`
    SELECT c.slug, c.name, c.domain, c.implemented,
           s.rating, s.attempts_count, s.stable_level
    FROM categories c
    LEFT JOIN user_category_state s
      ON s.category_slug = c.slug AND s.user_id = ${userId}
    WHERE c.active
    ORDER BY c.sort
  `;

  const views: CategoryRatingView[] = [];
  for (const r of cats) {
    const has = r.rating != null && r.rating > 0;
    const attempts = r.attempts_count ?? 0;
    if (!has) {
      views.push({
        slug: r.slug, name: r.name, domain: r.domain ?? 'other', implemented: r.implemented,
        rating: null, percentile: null, poolSize: 0, status: 'unrated',
        confidence: null, provisional: false, attempts, stableLevel: null, delta7d: null, sem: null
      });
      continue;
    }
    const pr = await categoryPercentile(r.slug, r.rating);
    const conf = confidence(attempts);
    views.push({
      slug: r.slug, name: r.name, domain: r.domain ?? 'other', implemented: r.implemented,
      rating: r.rating, percentile: pr.percentile, poolSize: pr.poolSize,
      status: pr.status, confidence: conf, provisional: conf === 'low',
      attempts, stableLevel: r.stable_level,
      delta7d: await categoryDelta(userId, r.slug, 7),
      sem: standardError(attempts)
    });
  }

  const rated = views.filter((v) => v.rating != null);
  let global: GlobalRatingView = {
    rating: null, percentile: null, poolSize: 0, status: 'unrated',
    confidence: null, provisional: false, delta7d: null, sem: null
  };
  if (rated.length > 0) {
    const avg = Math.round(rated.reduce((s, v) => s + (v.rating as number), 0) / rated.length);
    const totalAttempts = rated.reduce((s, v) => s + v.attempts, 0);
    // A global rating built on one or two categories is misleading - it implies a
    // broad measure it hasn't earned. Require coverage across several distinct
    // categories before presenting the overall as a real (percentile-bearing)
    // number; below that, show it as calibrating.
    const MIN_CATEGORIES_FOR_GLOBAL = 4;
    const enoughCoverage = rated.length >= MIN_CATEGORIES_FOR_GLOBAL;
    const includeSim = flags.simulatedUsers();
    const poolRows = await pg`
      SELECT avg(s.rating)::int AS rating
      FROM user_category_state s
      JOIN users u ON u.id = s.user_id
      WHERE s.attempts_count >= 10
        AND u.is_anonymous = false AND u.is_test = false
        AND (u.is_simulated = false OR ${includeSim})
      GROUP BY u.id
    `;
    const pool = poolRows.map((r: { rating: number }) => r.rating);
    const pct = enoughCoverage ? percentileOf(avg, pool, MIN_POOL_FOR_PERCENTILE) : null;
    const conf = confidence(totalAttempts);
    const deltas = rated.map((v) => v.delta7d).filter((d): d is number => d != null);
    const globalDelta = deltas.length ? Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null;
    global = {
      rating: avg, percentile: pct, poolSize: pool.length,
      // anonymous population position: a plain count, no names ever (roadmap: anonymous
      // population-position display). Only meaningful when a percentile is shown at all.
      aboveCount: pct == null ? null : pool.filter((r) => r > avg).length,
      status: pct == null ? 'calibrating' : 'ok',
      confidence: conf, provisional: conf === 'low' || !enoughCoverage, delta7d: globalDelta,
      sem: standardError(totalAttempts),
      categoriesRated: rated.length,
      categoriesNeeded: MIN_CATEGORIES_FOR_GLOBAL
    };

    // ---- Baseline-vs-now + improvement (immutable first-calibration ratings) ----
    // MY baseline global: avg of my per-category baselines, needing the same coverage as the
    // current global (>= MIN_CATEGORIES_FOR_GLOBAL categories) so the two numbers are comparable.
    const myBase = await pg`
      SELECT avg(rating)::int AS r, count(*)::int AS n
      FROM user_category_baseline WHERE user_id = ${userId}
    `;
    if ((myBase[0]?.n ?? 0) >= MIN_CATEGORIES_FOR_GLOBAL && myBase[0].r != null) {
      const myBaseline = myBase[0].r as number;
      // pool of everyone's baseline globals, same eligibility rules as the current pool
      const basePoolRows = await pg`
        SELECT avg(b.rating)::int AS rating
        FROM user_category_baseline b
        JOIN users u ON u.id = b.user_id
        WHERE u.is_anonymous = false AND u.is_test = false
          AND (u.is_simulated = false OR ${includeSim})
        GROUP BY u.id
        HAVING count(*) >= ${MIN_CATEGORIES_FOR_GLOBAL}
      `;
      const basePool = basePoolRows.map((r: { rating: number }) => r.rating);
      const basePct = percentileOf(myBaseline, basePool, MIN_POOL_FOR_PERCENTILE);
      global.baseline = {
        rating: myBaseline,
        percentile: basePct,
        poolSize: basePool.length,
        aboveCount: basePct == null ? null : basePool.filter((r) => r > myBaseline).length
      };
      // improvement distribution: per-user (current global - baseline global) over users with both
      const diffRows = await pg`
        SELECT (cur.r - base.r)::int AS diff
        FROM (
          SELECT s.user_id AS uid, avg(s.rating)::int AS r
          FROM user_category_state s JOIN users u ON u.id = s.user_id
          WHERE s.attempts_count >= 10
            AND u.is_anonymous = false AND u.is_test = false
            AND (u.is_simulated = false OR ${includeSim})
          GROUP BY s.user_id HAVING count(*) >= ${MIN_CATEGORIES_FOR_GLOBAL}
        ) cur
        JOIN (
          SELECT user_id AS uid, avg(rating)::int AS r
          FROM user_category_baseline
          GROUP BY user_id HAVING count(*) >= ${MIN_CATEGORIES_FOR_GLOBAL}
        ) base ON base.uid = cur.uid
      `;
      const diffs = diffRows.map((r: { diff: number }) => r.diff).sort((a: number, b: number) => a - b);
      const median = diffs.length ? diffs[Math.floor(diffs.length / 2)] : null;
      global.improvement = {
        points: avg - myBaseline,
        poolMedianPoints: diffs.length >= 5 ? median : null, // honest gate: a median of 3 people is noise
        poolN: diffs.length
      };
    }
  }
  return { categories: views, global };
}

export interface SessionSummary {
  id: string;
  startedAt: string;
  endedAt: string | null;
  attempts: number;
  accuracy: number | null;
  avgMs: number | null;
  minLevel: number | null;
  maxLevel: number | null;
  avgScore: number | null;
}

export interface PersistenceView {
  activeDays: string[];        // 'YYYY-MM-DD' the user practised, ascending
  totalActiveDays: number;
  daysLast30: number;
  currentRun: number;          // consecutive days up to today/yesterday
  longestRun: number;
  firstDay: string | null;
  weeks: { date: string; active: boolean; future: boolean; perf: number | null; n: number }[][]; // calendar grid (last 12 weeks); perf = that day's avg score [0,1]
}

// Persistence: how consistently the user shows up. A measured behavioural trait (willpower /
// organisation), reported descriptively - never a guilt-streak. The calendar strip + run lengths
// describe the pattern; no loss-framing, no "don't break it".
export async function userPersistence(userId: string): Promise<PersistenceView> {
  const rows = await pg`
    SELECT to_char(served_at, 'YYYY-MM-DD') AS day, avg(score)::float AS perf, count(*)::int AS n
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered'
    GROUP BY 1
    ORDER BY day
  `;
  const activeDays = (rows as { day: string }[]).map((r) => r.day);
  const perfByDay = new Map((rows as { day: string; perf: number | null; n: number }[]).map((r) => [r.day, { perf: r.perf, n: r.n }]));
  const daySet = new Set(activeDays);

  const dayMs = 24 * 3600 * 1000;
  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // longest + current run of consecutive calendar days
  let longestRun = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of activeDays) {
    const cur = toDate(d);
    if (prev && cur.getTime() - prev.getTime() === dayMs) run += 1;
    else run = 1;
    if (run > longestRun) longestRun = run;
    prev = cur;
  }

  // current run: count back from today (or yesterday) while days are present
  let currentRun = 0;
  const today = new Date(fmt(new Date()) + 'T00:00:00Z');
  // allow the run to be "current" if the last active day is today or yesterday
  const lastActive = activeDays.length ? toDate(activeDays[activeDays.length - 1]) : null;
  if (lastActive && today.getTime() - lastActive.getTime() <= dayMs) {
    let cursor = lastActive;
    while (daySet.has(fmt(cursor))) {
      currentRun += 1;
      cursor = new Date(cursor.getTime() - dayMs);
    }
  }

  const cutoff30 = Date.now() - 30 * dayMs;
  const daysLast30 = activeDays.filter((d) => toDate(d).getTime() >= cutoff30).length;

  // calendar grid: the last 12 weeks, ending on the column that contains today (GitHub-style).
  // We align so today sits in the final column at its weekday row, and we don't emit a near-empty
  // leading week. 12 weeks reads as "recent habit" without a huge empty expanse.
  const WEEKS = 12;
  const todayDow = (today.getUTCDay() + 6) % 7; // 0=Mon
  // start = Monday of the week that is (WEEKS-1) weeks before this week
  const thisMonday = new Date(today.getTime() - todayDow * dayMs);
  const gridStart = new Date(thisMonday.getTime() - (WEEKS - 1) * 7 * dayMs);
  const weeks: { date: string; active: boolean; future: boolean; perf: number | null; n: number }[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; active: boolean; future: boolean; perf: number | null; n: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const ds = fmt(cursor);
      const isFuture = cursor.getTime() > today.getTime();
      const pd = perfByDay.get(ds);
      week.push({ date: ds, active: daySet.has(ds) && !isFuture, future: isFuture, perf: pd?.perf ?? null, n: pd?.n ?? 0 });
      cursor = new Date(cursor.getTime() + dayMs);
    }
    weeks.push(week);
  }

  return {
    activeDays,
    totalActiveDays: activeDays.length,
    daysLast30,
    currentRun,
    longestRun,
    firstDay: activeDays[0] ?? null,
    weeks
  };
}

export async function userSessions(userId: string, limit = 30): Promise<SessionSummary[]> {
  const rows = await pg`
    SELECT p.id, p.started_at, p.ended_at,
           count(a.id) FILTER (WHERE a.status = 'answered')::int AS attempts,
           avg(CASE WHEN a.status = 'answered' THEN (a.correct::int)::float END) AS accuracy,
           avg(a.effective_ms) FILTER (WHERE a.status = 'answered')::int AS avg_ms,
           min(a.level) FILTER (WHERE a.status = 'answered')::int AS min_level,
           max(a.level) FILTER (WHERE a.status = 'answered')::int AS max_level,
           avg(a.score) FILTER (WHERE a.status = 'answered') AS avg_score
    FROM practice_sessions p
    LEFT JOIN attempts a ON a.session_id = p.id
    WHERE p.user_id = ${userId}
    GROUP BY p.id
    HAVING count(a.id) FILTER (WHERE a.status = 'answered') > 0
    ORDER BY p.started_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    startedAt: new Date(r.started_at as string | Date).toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at as string | Date).toISOString() : null,
    attempts: r.attempts as number,
    accuracy: r.accuracy != null ? Math.round((r.accuracy as number) * 100) : null,
    avgMs: (r.avg_ms as number) ?? null,
    minLevel: (r.min_level as number) ?? null,
    maxLevel: (r.max_level as number) ?? null,
    avgScore: r.avg_score != null ? Math.round((r.avg_score as number) * 100) / 100 : null
  }));
}

export interface AttemptRow {
  categorySlug: string;
  categoryName: string;
  level: number;
  prompt: string;
  yourAnswer: string | null;
  correctAnswer: string | null;
  correct: boolean | null;
  effectiveMs: number | null;
  score: number | null;
  fluencyWords?: { word: string; ok: boolean }[] | null;
}

function describePrompt(pd: Record<string, unknown>): string {
  if (pd.expression) return String(pd.expression);
  if (pd.sequence) return `${(pd.sequence as number[]).join(', ')}, ?`;
  if (pd.digits) return `Recall${pd.mode === 'reverse' ? ' reversed' : ''}: ${pd.digits}`;
  if (pd.symbols) return `${pd.instruction ?? 'Count'}`;
  if (pd.block) {
    const block = pd.block as string[];
    return `Count ${pd.target} in ${block.length}x${block[0].split(' ').length} grid`;
  }
  if (pd.stimulus) return `${pd.instruction ?? ''} ${pd.stimulus}`.trim();
  if (pd.instruction) return String(pd.instruction);
  return '\u2014';
}

function isSvgChoice(pd: Record<string, unknown>): boolean {
  const opts = pd.options as unknown[] | undefined;
  return Array.isArray(opts) && opts.length > 0 && typeof opts[0] === 'object';
}

function describeAnswer(pd: Record<string, unknown>, ad: Record<string, unknown>, raw: string | null): {
  your: string | null; correct: string | null;
} {
  // estimation: show the actual value
  if (ad.trueValue != null) {
    return { your: raw, correct: `actual ${ad.trueValue}` };
  }
  // fluency (verbal/retrieval): there's no single correct answer - the user produced a list matched
  // against an accept-list. Show their count, and "open" for the correct column (not null).
  const isFluency = Array.isArray(ad.acceptList) || ad.scoringMode === 'fluency_count';
  if (isFluency) {
    let your: string | null = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) your = `${parsed.length} word${parsed.length === 1 ? '' : 's'}`;
    } catch {
      // raw wasn't JSON; leave as-is
    }
    // Say what actually validated it: letter tasks (a constraint) are dictionary-checked;
    // semantic tasks are checked against the categorized topic wordlist (v0.65.0).
    const isLetterTask = typeof ad.constraint === 'string' && ad.constraint.length >= 1;
    return { your, correct: isLetterTask ? 'open - dictionary-checked (EN)' : 'open - topic wordlist (EN)' };
  }
  // planning (deliberate number-path): no single answer; show the goal + optimal length
  const isPlanning = ad.scoringMode === 'deliberate' || (ad.start != null && ad.target != null);
  if (isPlanning) {
    const your = raw && raw !== '' ? raw : null;
    const optimal = ad.optimalMoves != null ? ` (best: ${ad.optimalMoves} steps)` : '';
    return { your, correct: `reach ${ad.target}${optimal}` };
  }
  const opts = pd.options as unknown[] | undefined;
  if (Array.isArray(opts)) {
    if (isSvgChoice(pd)) {
      const your = raw != null && raw !== '' ? `option ${Number(raw) + 1}` : null;
      const correct = ad.correctAnswer != null ? `option ${Number(ad.correctAnswer) + 1}` : null;
      return { your, correct };
    }
    const your = raw != null && raw !== '' && opts[Number(raw)] != null ? String(opts[Number(raw)]) : raw;
    const correct = ad.correctAnswer != null && opts[Number(ad.correctAnswer)] != null
      ? String(opts[Number(ad.correctAnswer)]) : null;
    return { your, correct };
  }
  return { your: raw, correct: ad.correctAnswer != null ? String(ad.correctAnswer) : null };
}

export async function sessionAttempts(userId: string, sessionId: string): Promise<AttemptRow[]> {
  const rows = await pg`
    SELECT a.category_slug, a.level, a.answer, a.correct, a.effective_ms, a.score,
           c.prompt_data, c.answer_data, cat.name AS category_name
    FROM attempts a
    JOIN challenges c ON c.id = a.challenge_id
    JOIN categories cat ON cat.slug = a.category_slug
    WHERE a.user_id = ${userId} AND a.session_id = ${sessionId} AND a.status = 'answered'
    ORDER BY a.submitted_at ASC
  `;
  return rows.map((r: Record<string, unknown>) => {
    const pd = (r.prompt_data ?? {}) as Record<string, unknown>;
    const ad = (r.answer_data ?? {}) as Record<string, unknown>;
    const ans = describeAnswer(pd, ad, (r.answer as string) ?? null);
    return {
      categorySlug: r.category_slug as string,
      categoryName: r.category_name as string,
      level: r.level as number,
      prompt: describePrompt(pd),
      yourAnswer: ans.your,
      correctAnswer: ans.correct,
      correct: (r.correct as boolean) ?? null,
      effectiveMs: (r.effective_ms as number) ?? null,
      score: (r.score as number) ?? null,
      // For fluency, surface each produced word with whether it was accepted, so review can color
      // accepted words green and rejected ones dim - making the scoring legible.
      fluencyWords: fluencyWordVerdicts(pd, ad, (r.answer as string) ?? null)
    };
  });
}

// Re-derive which produced words were accepted, using the SAME rules as scoring (sessions/index.ts):
// rule-based for letter fluency (prefix/suffix), accept-list + 1-edit typo tolerance for semantic.
// Returns null for non-fluency attempts. Kept in sync with the scorer by mirroring its logic.
function fluencyWordVerdicts(
  pd: Record<string, unknown>, ad: Record<string, unknown>, raw: string | null
): { word: string; ok: boolean }[] | null {
  const isFluency = Array.isArray(ad.acceptList) || ad.scoringMode === 'fluency_count' || typeof ad.constraint === 'string';
  if (!isFluency || !raw) return null;
  let produced: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) produced = parsed.map((x) => String(x));
  } catch {
    produced = raw.split(/[,\n]/);
  }
  if (produced.length === 0) return null;
  const accept = new Set((ad.acceptList as string[] ?? []).map((a) => a.trim().toLowerCase()));
  const constraint = typeof ad.constraint === 'string' ? ad.constraint.toLowerCase() : '';
  const instr = ((pd.instruction as string) ?? '').toLowerCase();
  const isSuffix = /\bend(s|ing)?\b|ending\b/.test(instr);
  const isRuleFluency = constraint.length >= 1;
  const out: { word: string; ok: boolean }[] = [];
  const seen = new Set<string>();
  for (const rawW of produced) {
    const w = rawW.trim().toLowerCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    const plausible = w.length >= 2 && /^[a-z][a-z'-]*$/.test(w);
    let ok = false;
    if (isRuleFluency && plausible) {
      ok = isSuffix ? w.endsWith(constraint) : w.startsWith(constraint);
    } else if (accept.has(w)) {
      ok = true;
    } else if (w.length >= 5 && [...accept].some((a) => a.length >= 5 && editDistance(w, a, 1) <= 1)) {
      ok = true;
    }
    out.push({ word: w, ok });
  }
  return out;
}

export async function progressTrend(userId: string, points = 14): Promise<number[]> {
  const sessions = await userSessions(userId, points);
  return sessions.slice().reverse().map((s) => s.avgScore ?? 0);
}

export interface RatingHistoryPoint {
  t: string;
  rating: number;
}

export async function ratingHistory(userId: string, categorySlug: string | null, points = 60): Promise<RatingHistoryPoint[]> {
  const rows = categorySlug
    ? await pg`
        SELECT recorded_at, rating FROM rating_history
        WHERE user_id = ${userId} AND category_slug = ${categorySlug}
        ORDER BY recorded_at ASC LIMIT ${points}
      `
    : await pg`
        SELECT recorded_at, avg(rating)::int AS rating
        FROM rating_history
        WHERE user_id = ${userId}
        GROUP BY recorded_at
        ORDER BY recorded_at ASC LIMIT ${points}
      `;
  return rows.map((r: Record<string, unknown>) => ({
    t: new Date(r.recorded_at as string | Date).toISOString(),
    rating: r.rating as number
  }));
}

export async function poolSize(categorySlug: string): Promise<number> {
  const pool = await ratingPool(categorySlug);
  return pool.length;
}

export interface SessionDetail {
  id: string;
  attempts: number;
  accuracy: number | null;
  avgMs: number | null;
  minLevel: number | null;
  maxLevel: number | null;
  ratingDelta: number | null;
  byCategory: { slug: string; name: string; attempts: number; accuracy: number; ratingDelta: number | null }[];
  strongest: string | null;
  weakest: string | null;
  modulesUsed: string[];
}

/** The most recent session for a user, fully detailed - used by the summary page. */
export async function latestSessionDetail(userId: string): Promise<SessionDetail | null> {
  const sessions = await pg`
    SELECT id, modules_used FROM practice_sessions
    WHERE user_id = ${userId}
    ORDER BY last_activity_at DESC LIMIT 1
  `;
  if (sessions.length === 0) return null;
  const sessionId = sessions[0].id as string;
  const modulesUsed: string[] = (sessions[0].modules_used as string[] | null) ?? [];

  const agg = await pg`
    SELECT count(*)::int AS attempts,
           avg((correct::int)::float) AS accuracy,
           avg(effective_ms)::int AS avg_ms,
           min(level)::int AS min_level,
           max(level)::int AS max_level,
           min(rating_before) FILTER (WHERE rating_before IS NOT NULL) AS first_before,
           (array_agg(rating_after ORDER BY submitted_at DESC))[1] AS last_after
    FROM attempts
    WHERE session_id = ${sessionId} AND status = 'answered'
  `;
  const a = agg[0];
  if (!a || a.attempts === 0) return null;

  const cats = await pg`
    SELECT a.category_slug, cat.name,
           count(*)::int AS attempts,
           avg((a.correct::int)::float) AS accuracy,
           (array_agg(a.rating_after ORDER BY a.submitted_at DESC))[1]
             - (array_agg(a.rating_before ORDER BY a.submitted_at ASC))[1] AS rating_delta
    FROM attempts a
    JOIN categories cat ON cat.slug = a.category_slug
    WHERE a.session_id = ${sessionId} AND a.status = 'answered'
    GROUP BY a.category_slug, cat.name
    ORDER BY count(*) DESC
  `;
  const byCategory = cats.map((c: Record<string, unknown>) => ({
    slug: c.category_slug as string,
    name: c.name as string,
    attempts: c.attempts as number,
    accuracy: Math.round((c.accuracy as number) * 100),
    ratingDelta: c.rating_delta != null ? (c.rating_delta as number) : null
  }));

  // strongest/weakest by accuracy among categories with >= 2 attempts
  const ranked = byCategory.filter((c) => c.attempts >= 2).sort((x, y) => y.accuracy - x.accuracy);
  const strongest = ranked.length ? ranked[0].name : null;
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1].name : null;

  const ratingDelta = a.first_before != null && a.last_after != null
    ? (a.last_after as number) - (a.first_before as number)
    : null;

  return {
    id: sessionId,
    modulesUsed,
    attempts: a.attempts as number,
    accuracy: a.accuracy != null ? Math.round((a.accuracy as number) * 100) : null,
    avgMs: (a.avg_ms as number) ?? null,
    minLevel: (a.min_level as number) ?? null,
    maxLevel: (a.max_level as number) ?? null,
    ratingDelta,
    byCategory,
    strongest,
    weakest
  };
}

/** Other users' normalized errors on a given estimation challenge (for ranking). */
export async function estimationErrorPool(challengeId: string, excludeUserId: string): Promise<number[]> {
  const rows = await pg`
    SELECT est_error FROM attempts
    WHERE challenge_id = ${challengeId} AND est_error IS NOT NULL AND user_id <> ${excludeUserId}
    LIMIT 500
  `;
  return rows.map((r: { est_error: number }) => r.est_error);
}

export interface PatternBucket {
  key: number;        // hour 0-23, or dow 0-6, or session-position bucket
  label: string;
  attempts: number;
  accuracy: number;   // 0-100
  avgScore: number;   // 0-1
}

export interface PatternsView {
  byHour: PatternBucket[];
  byDow: PatternBucket[];
  byPosition: PatternBucket[];
  bestHour: PatternBucket | null;
  fatigueSignal: 'improves' | 'declines' | 'flat' | null;
  enoughData: boolean;
}

// Minimum answered attempts in a bucket before we trust it (noise guard).
const MIN_BUCKET = 8;
const MIN_TOTAL_FOR_PATTERNS = 40;

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Trend-of-state patterns: when is this user sharpest, do they fatigue within
 * a session. Honest about thin data - buckets below MIN_BUCKET are dropped, and
 * the whole view reports enoughData=false until there's a real baseline.
 */
export async function userPatterns(userId: string): Promise<PatternsView> {
  const totalRow = await pg`
    SELECT count(*)::int AS n FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND local_hour IS NOT NULL
  `;
  const total = totalRow[0]?.n ?? 0;
  const enoughData = total >= MIN_TOTAL_FOR_PATTERNS;

  const hourRows = await pg`
    SELECT local_hour AS k, count(*)::int AS attempts,
           avg((correct::int)::float) AS accuracy, avg(score) AS avg_score
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND local_hour IS NOT NULL
    GROUP BY local_hour ORDER BY local_hour
  `;
  const dowRows = await pg`
    SELECT local_dow AS k, count(*)::int AS attempts,
           avg((correct::int)::float) AS accuracy, avg(score) AS avg_score
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND local_dow IS NOT NULL
    GROUP BY local_dow ORDER BY local_dow
  `;
  // session position bucketed into ranges so it's readable
  const posRows = await pg`
    SELECT width_bucket(session_position, 1, 60, 6) AS k, count(*)::int AS attempts,
           avg((correct::int)::float) AS accuracy, avg(score) AS avg_score
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND session_position IS NOT NULL
    GROUP BY k ORDER BY k
  `;

  const toBucket = (r: Record<string, unknown>, label: string): PatternBucket => ({
    key: r.k as number,
    label,
    attempts: r.attempts as number,
    accuracy: Math.round((r.accuracy as number) * 100),
    avgScore: Math.round((r.avg_score as number) * 1000) / 1000
  });

  const byHour = hourRows
    .filter((r: Record<string, unknown>) => (r.attempts as number) >= MIN_BUCKET)
    .map((r: Record<string, unknown>) => toBucket(r, `${String(r.k).padStart(2, '0')}:00`));
  const byDow = dowRows
    .filter((r: Record<string, unknown>) => (r.attempts as number) >= MIN_BUCKET)
    .map((r: Record<string, unknown>) => toBucket(r, DOW_LABELS[r.k as number] ?? String(r.k)));
  const byPosition = posRows
    .filter((r: Record<string, unknown>) => (r.attempts as number) >= MIN_BUCKET)
    .map((r: Record<string, unknown>) => {
      const k = r.k as number;
      const lo = (k - 1) * 10 + 1;
      return toBucket(r, `${lo}\u2013${lo + 9}`);
    });

  const bestHour = byHour.length
    ? byHour.slice().sort((a, b) => b.avgScore - a.avgScore)[0]
    : null;

  // fatigue: compare avg score of first vs last position bucket
  let fatigueSignal: 'improves' | 'declines' | 'flat' | null = null;
  if (byPosition.length >= 2) {
    const first = byPosition[0].avgScore;
    const last = byPosition[byPosition.length - 1].avgScore;
    const d = last - first;
    fatigueSignal = d > 0.05 ? 'improves' : d < -0.05 ? 'declines' : 'flat';
  }

  return { byHour, byDow, byPosition, bestHour, fatigueSignal, enoughData };
}

export interface CategoryRecord {
  slug: string;
  name: string;
  peakRating: number | null;
  peakRatingAt: string | null;
  maxLevel: number | null;
  maxLevelAt: string | null;
}

export async function userRecords(userId: string): Promise<CategoryRecord[]> {
  const rows = await pg`
    SELECT c.slug, c.name, s.peak_rating, s.peak_rating_at, s.max_level, s.max_level_at
    FROM categories c
    JOIN user_category_state s ON s.category_slug = c.slug AND s.user_id = ${userId}
    WHERE c.active AND (s.peak_rating IS NOT NULL OR s.max_level IS NOT NULL)
    ORDER BY c.sort
  `;
  return rows.map((r: Record<string, unknown>) => ({
    slug: r.slug as string,
    name: r.name as string,
    peakRating: (r.peak_rating as number) ?? null,
    peakRatingAt: r.peak_rating_at ? new Date(r.peak_rating_at as string | Date).toISOString() : null,
    maxLevel: (r.max_level as number) ?? null,
    maxLevelAt: r.max_level_at ? new Date(r.max_level_at as string | Date).toISOString() : null
  }));
}

export interface DomainScore {
  domain: string;
  label: string;
  rating: number | null;     // confidence-weighted aggregate of member categories
  status: 'ok' | 'partial' | 'unrated';
  members: number;           // categories in this domain
  ratedMembers: number;      // how many the user has a rating in
}

export const DOMAIN_LABELS: Record<string, string> = {
  fluid_reasoning: 'Fluid Reasoning',
  processing_speed: 'Processing Speed',
  memory: 'Memory',
  quantitative: 'Quantitative',
  verbal: 'Verbal',
  executive_function: 'Executive Function',
  retention: 'Retention',
  retrieval: 'Retrieval',
  visual: 'Visual',
  reaction: 'Reaction',
  strategic_planning: 'Strategic Planning'
};

/** Cognitive-domain aggregate for the radar. Confidence-weighted by attempts;
 *  a domain with only some members rated is 'partial', honest about coverage. */
export interface DomainMedian {
  domain: string;
  median: number | null;   // population median rating in this domain (null if suppressed)
}

// Consented-population median rating per domain, for the blue "global" radar line.
// Suppressed below the public floor so it never reflects a handful of people. Excludes the
// current user so it reads as "everyone else". Honest statistic for skewed bounded ratings
// is the median, not the mean.
export async function populationDomainMedians(excludeUserId: string): Promise<DomainMedian[]> {
  const floor = adminConfig.publicMinCell();
  const includeSim = flags.simulatedUsers();
  const rows = await pg`
    WITH per_user_domain AS (
      SELECT u.id AS uid, c.domain, avg(s.rating)::numeric AS rating
      FROM users u
      JOIN user_attributes ua ON ua.user_id = u.id AND ua.consented_stats = true
      JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0
      JOIN categories c ON c.slug = s.category_slug AND c.active AND c.domain IS NOT NULL
      WHERE u.id <> ${excludeUserId}
        AND u.is_test = false
        AND (u.is_simulated = false OR ${includeSim})
      GROUP BY u.id, c.domain
    )
    SELECT domain,
           count(*)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rating) AS median
    FROM per_user_domain
    GROUP BY domain
    ORDER BY domain
  `;
  return rows.map((r: Record<string, unknown>) => ({
    domain: r.domain as string,
    // k-anonymity: hide any domain whose population is below the floor
    median: (r.n as number) >= floor && r.median != null ? Math.round(Number(r.median)) : null
  }));
}

export interface DomainRange {
  domain: string;
  min: number | null;   // lowest rating ever recorded in any category of this domain
  max: number | null;   // highest ever
}

// Per-domain historical min/max from rating_history, for the radar's min/max planes.
// NOTE these are composite envelopes: a domain's all-time min and all-time max did not
// necessarily occur at the same time as each other or as the current shape.
export async function userDomainRanges(userId: string): Promise<DomainRange[]> {
  const rows = await pg`
    SELECT c.domain,
           min(h.rating)::int AS lo,
           max(h.rating)::int AS hi
    FROM rating_history h
    JOIN categories c ON c.slug = h.category_slug
    WHERE h.user_id = ${userId} AND c.active AND c.domain IS NOT NULL AND h.rating > 0
    GROUP BY c.domain
    ORDER BY c.domain
  `;
  return rows.map((r: Record<string, unknown>) => ({
    domain: r.domain as string,
    min: (r.lo as number) ?? null,
    max: (r.hi as number) ?? null
  }));
}

export interface DomainSnapshot {
  date: string;                          // 'YYYY-MM-DD' of this snapshot
  domains: { domain: string; rating: number | null }[];
}

// Reconstruct the radar shape at a series of past dates, for the "through time" view. For each
// snapshot date we take each category's rating AS OF that date (latest rating_history row on or
// before it) and roll categories up into domains. NOTE: live userDomains weights by attempt count;
// historical attempt counts aren't snapshotted, so here we average the as-of category ratings per
// domain (equal weight). It's a faithful shape of progression, with this one honest simplification.
export async function domainTimeline(userId: string, maxSnapshots = 24): Promise<DomainSnapshot[]> {
  // all rating-change events for this user, with their domain, in time order
  const rows = await pg`
    SELECT to_char(h.recorded_at, 'YYYY-MM-DD') AS day,
           h.recorded_at AS ts,
           h.category_slug AS slug,
           c.domain AS domain,
           h.rating AS rating
    FROM rating_history h
    JOIN categories c ON c.slug = h.category_slug AND c.active AND c.domain IS NOT NULL
    WHERE h.user_id = ${userId} AND h.rating > 0
    ORDER BY h.recorded_at ASC
  `;
  const events = rows as { day: string; ts: string; slug: string; domain: string; rating: number }[];
  if (events.length === 0) return [];

  // current per-category attempt weights, so the rollup matches the LIVE radar (userDomains), which
  // is an attempts-count-weighted average. Without this the final timeline frame wouldn't equal the
  // current radar shape. We use current weights as the best available proxy (historical per-snapshot
  // attempt counts aren't stored); this guarantees the last frame matches and keeps earlier frames
  // consistent in method.
  const weightRows = await pg`
    SELECT category_slug AS slug, attempts_count AS w
    FROM user_category_state WHERE user_id = ${userId}
  `;
  const weightFor = new Map((weightRows as { slug: string; w: number }[]).map((r) => [r.slug, Math.max(1, r.w)]));

  // distinct days on which anything changed
  const days = [...new Set(events.map((e) => e.day))];
  // downsample to at most maxSnapshots, always keeping the first and last
  let picked: string[];
  if (days.length <= maxSnapshots) {
    picked = days;
  } else {
    picked = [];
    const step = (days.length - 1) / (maxSnapshots - 1);
    for (let i = 0; i < maxSnapshots; i++) picked.push(days[Math.round(i * step)]);
    picked = [...new Set(picked)];
  }

  // for each picked day, the latest rating per category as of end of that day
  const snapshots: DomainSnapshot[] = [];
  for (const day of picked) {
    const latestPerSlug = new Map<string, { rating: number; domain: string; slug: string }>();
    for (const e of events) {
      if (e.day <= day) latestPerSlug.set(e.slug, { rating: e.rating, domain: e.domain, slug: e.slug });
      else break; // events are time-ordered
    }
    // roll up to domains using the SAME attempts-weighting as the live radar
    const byDomain = new Map<string, { wsum: number; wtot: number }>();
    for (const { rating, domain, slug } of latestPerSlug.values()) {
      const w = weightFor.get(slug) ?? 1;
      if (!byDomain.has(domain)) byDomain.set(domain, { wsum: 0, wtot: 0 });
      const acc = byDomain.get(domain)!;
      acc.wsum += rating * w;
      acc.wtot += w;
    }
    const domains = [...byDomain.entries()].map(([domain, acc]) => ({
      domain,
      rating: acc.wtot > 0 ? Math.round(acc.wsum / acc.wtot) : 0
    }));
    snapshots.push({ date: day, domains });
  }
  return snapshots;
}

export interface DomainSparkline {
  domain: string;
  label: string;
  series: number[];      // rating over time (downsampled), oldest -> newest
  first: number | null;
  last: number | null;
  deltaPct: number | null;
}

// A compact rating trajectory per domain, for the sparkline grid: "which areas are trending up,
// flat, or down". Built from rating_history, averaging as-of category ratings per domain at each
// change-day, then downsampled to a short series for drawing.
export async function domainSparklines(userId: string, points = 20): Promise<DomainSparkline[]> {
  const snaps = await domainTimeline(userId, Math.max(points, 8));
  if (snaps.length === 0) return [];

  // collect a per-domain series across snapshots (carry forward last known value)
  const domains = [...new Set(snaps.flatMap((s) => s.domains.map((d) => d.domain)))];
  const out: DomainSparkline[] = [];
  for (const domain of domains) {
    const series: number[] = [];
    let last: number | null = null;
    for (const s of snaps) {
      const found = s.domains.find((d) => d.domain === domain);
      if (found) last = found.rating;
      if (last != null) series.push(last);
    }
    if (series.length < 2) continue;
    const first = series[0];
    const lastVal = series[series.length - 1];
    out.push({
      domain,
      label: DOMAIN_LABELS[domain] ?? domain,
      series,
      first,
      last: lastVal,
      deltaPct: first > 0 ? Math.round(((lastVal - first) / first) * 100) : null
    });
  }
  return out;
}

export interface DomainPercentile {
  domain: string;
  label: string;
  percentile: number | null;   // 0-100, the user's rank vs consented population in this domain
  rating: number | null;
  popN: number;                // population size compared against (for honesty)
}

// Where the user sits versus the consented population, per domain, as a PERCENTILE. This is the
// most legible "how do I compare" device - "80th percentile for memory" reads instantly. Honest:
// null until there's a real population to rank against (>= the public floor), and it excludes the
// user themselves. Uses each population member's per-domain average rating as the comparison set.
export async function userPercentiles(userId: string): Promise<DomainPercentile[]> {
  const floor = adminConfig.publicMinCell();
  const own = await userDomains(userId);
  const ownByDomain = new Map(own.map((d) => [d.domain, d.rating]));

  const rows = await pg`
    WITH pop AS (
      SELECT c.domain, avg(s.rating)::float AS rating
      FROM users u
      JOIN user_attributes ua ON ua.user_id = u.id AND ua.consented_stats = true
      JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0
      JOIN categories c ON c.slug = s.category_slug AND c.active AND c.domain IS NOT NULL
      WHERE u.id <> ${userId} AND u.is_test = false AND u.is_simulated = false
      GROUP BY u.id, c.domain
    )
    SELECT domain, count(*)::int AS n,
           array_agg(rating) AS ratings
    FROM pop GROUP BY domain
  `;
  const popByDomain = new Map(
    (rows as { domain: string; n: number; ratings: number[] }[]).map((r) => [r.domain, r])
  );

  return own.map((d) => {
    const pop = popByDomain.get(d.domain);
    const ownRating = ownByDomain.get(d.domain) ?? null;
    let percentile: number | null = null;
    if (pop && pop.n >= floor && ownRating != null) {
      const below = pop.ratings.filter((r) => r < ownRating).length;
      percentile = Math.round((below / pop.ratings.length) * 100);
    }
    return {
      domain: d.domain,
      label: d.label,
      percentile,
      rating: ownRating,
      popN: pop?.n ?? 0
    };
  });
}

export interface StatsHeadline {
  text: string;
  tone: 'up' | 'flat' | 'down' | 'early';
}

// A single human sentence stating the user's current state + direction, for the "5-second test":
// someone should grasp where they stand without reading the whole page. Built from sparkline trends
// (direction) and percentiles (standing). Deliberately honest and non-hyping.
export function statsHeadline(
  sparklines: { label: string; deltaPct: number | null }[],
  percentiles: { label: string; percentile: number | null }[]
): StatsHeadline {
  const trended = sparklines.filter((s) => s.deltaPct != null);
  if (trended.length === 0) {
    return { text: "You're just getting started - a few more sessions and your trends and standing will take shape here.", tone: 'early' };
  }
  const up = trended.filter((s) => (s.deltaPct as number) >= 3);
  const down = trended.filter((s) => (s.deltaPct as number) <= -3);

  // strongest standing, if percentiles exist
  const ranked = percentiles.filter((p) => p.percentile != null).sort((a, b) => (b.percentile as number) - (a.percentile as number));
  const strongest = ranked[0];
  const standingBit = strongest
    ? ` ${strongest.label} is your strongest area right now (top ${100 - (strongest.percentile as number)}%).`
    : '';

  if (up.length > down.length) {
    return { text: `You're trending up in ${up.length} of ${trended.length} areas.${standingBit}`, tone: 'up' };
  }
  if (down.length > up.length) {
    return { text: `You've dipped in ${down.length} of ${trended.length} areas lately - worth noting, not alarming; performance naturally varies.${standingBit}`, tone: 'down' };
  }
  return { text: `You're holding steady across your areas.${standingBit}`, tone: 'flat' };
}

export interface Readiness {
  overallPct: number;           // 0-100, blended progress toward a "full, valid" profile
  sessions: { have: number; need: number };       // toward insights (MIN_TOTAL_SESSIONS)
  calibratedDomains: { have: number; total: number }; // domains past the provisional (10-attempt) gate
  insightsReady: boolean;
  // Two-tier model: Tier 1 = every ability measured (reachable fast); Tier 2 = deep statistical profile.
  profile: { pct: number; complete: boolean; have: number; total: number };
  deep: { pct: number; ready: boolean; have: number; need: number };
  message: string;
}

// An honest "how complete is my profile" signal - NOT a fake progress bar. It tracks the REAL gates:
// (1) domains calibrated past provisional (>=10 attempts each), and (2) sessions toward the insights
// threshold. The ring fills as the user's measurements actually become valid, which is a truthful
// reason to keep going (your numbers aren't trustworthy yet) rather than a streak guilt-trip.
export async function userReadiness(userId: string): Promise<Readiness> {
  const INSIGHT_SESSIONS = 20;     // deep-profile depth: stable trends, best/worst reliability, insights
  const CALIBRATE_ATTEMPTS = 10;   // a category rating stops being provisional at 10 attempts

  // distinct practice days (sessions proxy, same as insights uses)
  const sessRows = await pg`
    SELECT count(DISTINCT to_char(served_at, 'YYYY-MM-DD'))::int AS n
    FROM attempts WHERE user_id = ${userId} AND status = 'answered'
  `;
  const sessions = (sessRows as { n: number }[])[0]?.n ?? 0;

  // TIER 1 - "profile complete": every implemented CATEGORY measured to calibration. The bar is
  // >=10 attempts for bank categories, but RETENTION calibrates at 3: its attempts_count only
  // counts genuinely-DUE recalls (SM-2), and a 10-due-review bar would silently gate "profile
  // complete" on WEEKS of maturing intervals, breaking the "a few focused days" promise. Three
  // real due recalls is an honest first read for a construct that matures over days by nature.
  const catRows = await pg`
    SELECT
      (SELECT count(*)::int FROM categories WHERE implemented AND active) AS total,
      (SELECT count(*)::int FROM user_category_state s
         JOIN categories c ON c.slug = s.category_slug AND c.implemented AND c.active
        WHERE s.user_id = ${userId}
          AND s.attempts_count >= CASE WHEN s.category_slug = 'retention' THEN 3 ELSE ${CALIBRATE_ATTEMPTS} END) AS calibrated
  `;
  const totalCats = (catRows as { total: number }[])[0]?.total ?? 1;
  const calibratedCats = (catRows as { calibrated: number }[])[0]?.calibrated ?? 0;
  const profilePct = Math.round(Math.min(1, calibratedCats / Math.max(1, totalCats)) * 100);
  const profileComplete = calibratedCats >= totalCats && totalCats > 0;

  // TIER 2 - "deep profile": enough repeat days for stable trends and insights.
  const depthPct = Math.round(Math.min(1, sessions / INSIGHT_SESSIONS) * 100);
  const insightsReady = sessions >= INSIGHT_SESSIONS;

  // domains calibrated (kept for the existing breadth readout)
  const domRows = await pg`
    SELECT count(DISTINCT c.domain)::int AS calibrated
    FROM user_category_state s
    JOIN categories c ON c.slug = s.category_slug AND c.active AND c.domain IS NOT NULL
    WHERE s.user_id = ${userId} AND s.attempts_count >= ${CALIBRATE_ATTEMPTS}
  `;
  const totalDomRows = await pg`SELECT count(DISTINCT domain)::int AS n FROM categories WHERE implemented AND active AND domain IS NOT NULL`;
  const calibrated = (domRows as { calibrated: number }[])[0]?.calibrated ?? 0;
  const totalDomains = (totalDomRows as { n: number }[])[0]?.n ?? 1;

  // overall ring still blends the two, but now each tier is reported separately so the UI can show
  // the nearer, more motivating "profile complete" milestone first.
  // Overall progress is mostly about MEASURING every ability (the reachable, motivating milestone).
  // Depth (repeat days for stable trends) is a gentle secondary component, not a half-weight gate -
  // otherwise a fully-measured profile would still read ~50% until an arbitrary session count, which
  // is the "20-day wall" feeling we deliberately removed. Profile complete alone reaches 85%; the
  // last 15% eases in with accumulated days.
  const overallPct = Math.round((Math.min(1, profilePct / 100) * 0.85 + Math.min(1, depthPct / 100) * 0.15) * 100);

  let message: string;
  if (insightsReady && profileComplete) message = 'Full profile and stable trends. Insights keep refining as you log more.';
  else if (profileComplete) message = `Profile complete - every ability measured. Insights appear as patterns emerge in your data; trends keep stabilising as you go.`;
  else if (sessions === 0) message = 'Practice a little each day - your profile fills as each ability gets measured.';
  else message = `${totalCats - calibratedCats} area${totalCats - calibratedCats === 1 ? '' : 's'} left to measure for a complete profile.`;

  return {
    overallPct,
    sessions: { have: sessions, need: INSIGHT_SESSIONS },
    calibratedDomains: { have: calibrated, total: totalDomains },
    insightsReady,
    // two-tier model
    profile: { pct: profilePct, complete: profileComplete, have: calibratedCats, total: totalCats },
    deep: { pct: depthPct, ready: insightsReady, have: sessions, need: INSIGHT_SESSIONS },
    message
  };
}

export interface PerfDay {
  date: string;       // YYYY-MM-DD (local)
  avgScore: number;   // mean attempt score that day (0-100)
  attempts: number;
  tags: string[];     // tags the user logged that day
  note: string | null; // any day-note already attached
}
export interface BestWorst {
  best: PerfDay[];
  worst: PerfDay[];
  qualifyingDays: number;
  // honesty flag: with few days, "best/worst" is noisy. We still SHOW it early (it's motivating and
  // the user asked for it), but flag when it's based on limited data so it isn't read as settled.
  limited: boolean;
}

// Best/worst performing DAYS, available early (from 3 qualifying days) but honestly labelled as
// "limited" until there's enough history to be stable. A day qualifies if it has enough attempts to
// be a fair sample (>= MIN_ATTEMPTS_PER_DAY), so a single lucky answer can't crown a "best day".
export async function bestWorstDays(userId: string, k = 2): Promise<BestWorst> {
  const MIN_ATTEMPTS_PER_DAY = 5;
  const STABLE_DAYS = 10; // below this, flag as limited
  const rows = await pg`
    SELECT to_char(a.served_at, 'YYYY-MM-DD') AS date,
           round(avg(a.score))::int AS avg_score,
           count(*)::int AS attempts
    FROM attempts a
    WHERE a.user_id = ${userId} AND a.status = 'answered' AND a.score IS NOT NULL
    GROUP BY to_char(a.served_at, 'YYYY-MM-DD')
    HAVING count(*) >= ${MIN_ATTEMPTS_PER_DAY}
    ORDER BY avg_score DESC
  `;
  const days = rows as { date: string; avg_score: number; attempts: number }[];
  const qualifyingDays = days.length;

  // pull tags + any day-note for the surfaced days
  async function decorate(d: { date: string; avg_score: number; attempts: number }): Promise<PerfDay> {
    const tagRows = await pg`
      SELECT DISTINCT unnest(tags) AS tag FROM session_context
      WHERE user_id = ${userId} AND local_date = ${d.date} AND tags IS NOT NULL
    `;
    const noteRows = await pg`
      SELECT note FROM day_note WHERE user_id = ${userId} AND local_date = ${d.date} LIMIT 1
    `;
    return {
      date: d.date,
      avgScore: d.avg_score,
      attempts: d.attempts,
      tags: (tagRows as { tag: string }[]).map((r) => r.tag),
      note: (noteRows as { note: string }[])[0]?.note ?? null
    };
  }

  const best = await Promise.all(days.slice(0, k).map(decorate));
  const worst = await Promise.all(days.slice(-k).reverse().map(decorate));
  return { best, worst, qualifyingDays, limited: qualifyingDays < STABLE_DAYS };
}

// Attach (or update) a free-text note to a specific local day. Private to the user.
export async function setDayNote(userId: string, date: string, note: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const clean = note.trim().slice(0, 500);
  if (!clean) {
    await pg`DELETE FROM day_note WHERE user_id = ${userId} AND local_date = ${date}`;
    return;
  }
  await pg`
    INSERT INTO day_note (user_id, local_date, note)
    VALUES (${userId}, ${date}, ${clean})
    ON CONFLICT (user_id, local_date)
    DO UPDATE SET note = EXCLUDED.note, updated_at = now()
  `;
}

export async function userDomains(userId: string): Promise<DomainScore[]> {
  const rows = await pg`
    SELECT c.domain,
           count(*)::int AS members,
           count(s.rating) FILTER (WHERE s.rating > 0)::int AS rated_members,
           sum(CASE WHEN s.rating > 0 THEN s.rating * s.attempts_count ELSE 0 END)::float AS weighted_sum,
           sum(CASE WHEN s.rating > 0 THEN s.attempts_count ELSE 0 END)::float AS weight_total
    FROM categories c
    LEFT JOIN user_category_state s ON s.category_slug = c.slug AND s.user_id = ${userId}
    WHERE c.active AND c.domain IS NOT NULL
    GROUP BY c.domain
    ORDER BY c.domain
  `;
  return rows.map((r: Record<string, unknown>) => {
    const members = r.members as number;
    const rated = r.rated_members as number;
    const wt = (r.weight_total as number) ?? 0;
    const rating = rated > 0 && wt > 0 ? Math.round((r.weighted_sum as number) / wt) : null;
    const status: 'ok' | 'partial' | 'unrated' =
      rated === 0 ? 'unrated' : rated < members ? 'partial' : 'ok';
    return {
      domain: r.domain as string,
      label: DOMAIN_LABELS[r.domain as string] ?? (r.domain as string),
      rating,
      status,
      members,
      ratedMembers: rated
    };
  });
}

export interface DistributionView {
  // anonymous, faceless: the shape of the rated population + the user's marker
  buckets: { rating: number; count: number }[];
  userRating: number | null;
  poolSize: number;
}

/** Anonymous distribution of global ratings across the rated pool, with the
 *  user's own marker. No identities, no ranking of others - just the field. */
export async function ratingDistribution(userId: string): Promise<DistributionView> {
  const includeSim = flags.simulatedUsers();
  const rows = await pg`
    SELECT width_bucket(avg_rating, 600, 1900, 26) AS b, count(*)::int AS count
    FROM (
      SELECT u.id, avg(s.rating)::int AS avg_rating
      FROM user_category_state s
      JOIN users u ON u.id = s.user_id
      WHERE s.attempts_count >= 10 AND s.rating > 0
        AND u.is_anonymous = false AND u.is_test = false
        AND (u.is_simulated = false OR ${includeSim})
      GROUP BY u.id
    ) per_user
    GROUP BY b ORDER BY b
  `;
  const buckets = rows.map((r: Record<string, unknown>) => ({
    rating: 600 + ((r.b as number) - 1) * 50,
    count: r.count as number
  }));
  const poolSize = buckets.reduce((s: number, b: { count: number }) => s + b.count, 0);

  const me = await pg`
    SELECT avg(rating)::int AS r FROM user_category_state
    WHERE user_id = ${userId} AND rating > 0
  `;
  return { buckets, userRating: me[0]?.r ?? null, poolSize };
}

// --- v1.7.0 additions ---

// Per-category 30-day sparkline values (avg score per active day, normalized 0..1).
// Days without data are simply absent - gaps are honest, no fabricated flat lines.
export async function categorySparklines(userId: string): Promise<Record<string, number[]>> {
  const rows = await pg`
    SELECT category_slug,
           avg(score)::float AS v
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND score IS NOT NULL
      AND submitted_at > now() - interval '30 days'
    GROUP BY category_slug, date_trunc('day', submitted_at)
    ORDER BY category_slug, date_trunc('day', submitted_at)
  `;
  const out: Record<string, number[]> = {};
  for (const r of rows as { category_slug: string; v: number }[]) {
    (out[r.category_slug] ??= []).push(Math.max(0, Math.min(1, r.v)));
  }
  return out;
}

// Named remaining areas (C1): which implemented categories are still below their
// calibration gate, with progress. Retention calibrates at 3 due recalls (see readiness
// notes above); everything else at 10 attempts.
export async function readinessMissing(
  userId: string
): Promise<{ slug: string; name: string; have: number; need: number }[]> {
  const rows = await pg`
    SELECT c.slug, c.name,
           coalesce(s.attempts_count, 0)::int AS have,
           CASE WHEN c.slug = 'retention' THEN 3 ELSE 10 END AS need
    FROM categories c
    LEFT JOIN user_category_state s ON s.category_slug = c.slug AND s.user_id = ${userId}
    WHERE c.implemented AND c.active
      AND coalesce(s.attempts_count, 0) < CASE WHEN c.slug = 'retention' THEN 3 ELSE 10 END
    ORDER BY coalesce(s.attempts_count, 0) DESC, c.sort
  `;
  return rows as { slug: string; name: string; have: number; need: number }[];
}
