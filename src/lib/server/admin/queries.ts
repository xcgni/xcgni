import { pg } from '$lib/server/db';
import { flags, adminConfig } from '$lib/server/flags';
import { summarize, suppressCount, type Summary } from './stats';

// All admin queries operate on AGGREGATES ONLY and respect:
//  - consent: attribute slices use only users with consented_stats = true
//  - suppression: no group below adminConfig.minCell() is shown
//  - no individual rows ever leave these functions
// Simulated users are included only while the simulated flag is on, same as
// the user-facing pool, so dev numbers are coherent.

// Composable predicate fragment for "a real, pool-eligible user".
// Uses nested pg`` fragments (postgres.js composes these safely) rather than
// pg.unsafe(), so no raw SQL strings are interpolated.
function poolPredicate() {
  const includeSim = flags.simulatedUsers();
  return pg`u.is_anonymous = false AND u.is_test = false AND (u.is_simulated = false OR ${includeSim})`;
}

export interface PopulationVitals {
  ratedUsers: number | null;
  totalAttempts: number;
  totalSessions: number;
  consentedUsers: number | null;
  consentRate: number | null; // fraction of registered users who consented
  attemptsLast7d: number;
}

export async function populationVitals(): Promise<PopulationVitals> {
  const minCell = adminConfig.minCell();
  const includeSim = flags.simulatedUsers();

  const rated = await pg`
    SELECT count(DISTINCT u.id)::int AS n
    FROM users u JOIN user_category_state s ON s.user_id = u.id
    WHERE s.attempts_count >= 10 AND s.rating > 0
      AND u.is_anonymous = false AND u.is_test = false
      AND (u.is_simulated = false OR ${includeSim})
  `;
  const attempts = await pg`SELECT count(*)::int AS n FROM attempts WHERE status = 'answered'`;
  const sessions = await pg`SELECT count(*)::int AS n FROM practice_sessions`;
  const last7 = await pg`SELECT count(*)::int AS n FROM attempts WHERE status='answered' AND submitted_at > now() - interval '7 days'`;
  const registered = await pg`
    SELECT count(*)::int AS n FROM users u WHERE u.is_anonymous = false AND u.is_test = false AND (u.is_simulated = false OR ${includeSim})
  `;
  const consented = await pg`
    SELECT count(*)::int AS n FROM user_attributes a JOIN users u ON u.id = a.user_id
    WHERE a.consented_stats = true AND u.is_anonymous = false AND u.is_test = false AND (u.is_simulated = false OR ${includeSim})
  `;
  const regN = registered[0]?.n ?? 0;
  const consN = consented[0]?.n ?? 0;
  return {
    ratedUsers: suppressCount(rated[0]?.n ?? 0, minCell),
    totalAttempts: attempts[0]?.n ?? 0,
    totalSessions: sessions[0]?.n ?? 0,
    consentedUsers: suppressCount(consN, minCell),
    consentRate: regN > 0 ? Math.round((consN / regN) * 100) / 100 : null,
    attemptsLast7d: last7[0]?.n ?? 0
  };
}

export interface DerivedMetrics {
  returnRate7d: number | null;       // % of users active >7d ago who returned within the next 7d
  returnRate1d: number | null;       // % of users whose first day was >1d ago who came back another day
  medianAttemptsPerSession: number | null;
  avgSessionsPerUser: number | null; // among users who have practised
  busiestHourUtc: number | null;     // local hour with the most attempts
  busiestHourShare: number | null;   // fraction of attempts in that hour
  repeatUsers: number;               // users who practised on 2+ distinct days (the validation-grade ones)
  oneAndDone: number;                // users who practised on exactly 1 day
}

// The metrics an operator actually learns from: are people COMING BACK (the only real signal that
// a training product works), how deep do sessions go, and when is the load. Test/simulated excluded.
export async function derivedMetrics(): Promise<DerivedMetrics> {
  // distinct practice days per user (the spine of retention)
  const dayRows = await pg`
    SELECT user_id, count(DISTINCT to_char(served_at, 'YYYY-MM-DD'))::int AS days,
           min(served_at) AS first_seen, max(served_at) AS last_seen
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    WHERE u.is_test = false AND u.is_simulated = false
    GROUP BY user_id
  `;
  const rows = dayRows as { user_id: string; days: number; first_seen: string; last_seen: string }[];
  const practisedUsers = rows.length;
  const repeatUsers = rows.filter((r) => r.days >= 2).length;
  const oneAndDone = rows.filter((r) => r.days === 1).length;

  // return-rate (1d): of users whose first day was at least 1 day ago, what share practised on
  // more than one day? (an honest, simple "did they come back at all" proxy)
  const eligible1d = rows.filter((r) => Date.now() - new Date(r.first_seen).getTime() > 24 * 3600 * 1000);
  const returned1d = eligible1d.filter((r) => r.days >= 2).length;
  const returnRate1d = eligible1d.length >= 10 ? returned1d / eligible1d.length : null;

  // return-rate (7d): of users whose first day was at least 7 days ago, share who came back
  const eligible7d = rows.filter((r) => Date.now() - new Date(r.first_seen).getTime() > 7 * 24 * 3600 * 1000);
  const returned7d = eligible7d.filter((r) => r.days >= 2).length;
  const returnRate7d = eligible7d.length >= 10 ? returned7d / eligible7d.length : null;

  const avgSessionsPerUser = practisedUsers > 0
    ? Math.round((rows.reduce((a, r) => a + r.days, 0) / practisedUsers) * 10) / 10
    : null;

  // median attempts per session
  const apsRows = await pg`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY c)::float AS med FROM (
      SELECT session_id, count(*)::int AS c FROM attempts a
      JOIN users u ON u.id = a.user_id
      WHERE u.is_test = false AND u.is_simulated = false AND a.status = 'answered'
      GROUP BY session_id
    ) q
  `;
  const medianAttemptsPerSession = (apsRows as { med: number | null }[])[0]?.med ?? null;

  // busiest local hour
  const hourRows = await pg`
    SELECT local_hour AS h, count(*)::int AS n FROM attempts a
    JOIN users u ON u.id = a.user_id
    WHERE u.is_test = false AND u.is_simulated = false AND local_hour IS NOT NULL
    GROUP BY local_hour ORDER BY n DESC
  `;
  const hours = hourRows as { h: number; n: number }[];
  const totalHourAttempts = hours.reduce((a, r) => a + r.n, 0);
  const busiestHourUtc = hours[0]?.h ?? null;
  const busiestHourShare = totalHourAttempts > 0 && hours[0] ? hours[0].n / totalHourAttempts : null;

  return {
    returnRate7d,
    returnRate1d,
    medianAttemptsPerSession: medianAttemptsPerSession != null ? Math.round(medianAttemptsPerSession * 10) / 10 : null,
    avgSessionsPerUser,
    busiestHourUtc,
    busiestHourShare,
    repeatUsers,
    oneAndDone
  };
}

export interface DataQuality {
  totalAttempts: number;
  cleanAttempts: number;
  flagged: { flag: string; n: number }[];
  inputBreakdown: { method: string; n: number }[];
  consentStamped: number;     // consented users with a recorded consent timestamp/version
  consentTotal: number;
}

// Dataset health: how much of the collected data is clean vs flagged, so you can judge validity at
// a glance and know early data stays analysable. Flags never delete - they let analysis exclude.
export async function dataQuality(): Promise<DataQuality> {
  const total = await pg`SELECT count(*)::int AS n FROM attempts WHERE status = 'answered'`;
  const clean = await pg`SELECT count(*)::int AS n FROM attempts WHERE status = 'answered' AND cardinality(quality_flags) = 0`;
  const flags = await pg`
    SELECT flag, count(*)::int AS n
    FROM attempts, unnest(quality_flags) AS flag
    WHERE status = 'answered'
    GROUP BY flag ORDER BY n DESC
  `;
  const inputs = await pg`
    SELECT COALESCE(input_method, 'unknown') AS method, count(*)::int AS n
    FROM attempts WHERE status = 'answered'
    GROUP BY input_method ORDER BY n DESC
  `;
  const consent = await pg`
    SELECT
      count(*) FILTER (WHERE consented_stats = true)::int AS total,
      count(*) FILTER (WHERE consented_stats = true AND consent_at IS NOT NULL AND consent_version IS NOT NULL)::int AS stamped
    FROM user_attributes
  `;
  const c = (consent as { total: number; stamped: number }[])[0];
  return {
    totalAttempts: total[0]?.n ?? 0,
    cleanAttempts: clean[0]?.n ?? 0,
    flagged: flags as { flag: string; n: number }[],
    inputBreakdown: inputs as { method: string; n: number }[],
    consentStamped: c?.stamped ?? 0,
    consentTotal: c?.total ?? 0
  };
}

export interface SiteMetrics {
  registeredUsers: number;        // real (non-test) registered accounts
  anonymousUsers: number;         // anonymous accounts ever created
  activeNow: number;              // distinct users with an attempt in the last 15 min
  activeToday: number;            // distinct users with an attempt in the last 24h
  signups24h: number;             // new registered accounts in the last 24h
  signups7d: number;
  newAnon24h: number;             // new anonymous accounts in the last 24h ("anonymous runs")
  newAnon7d: number;
  practisedRegistered: number; // registered users who have actually practised (not just signed up)
}

// Operational website metrics (NOT research stats). Test/simulated users are always excluded
// here so the numbers reflect real traffic. "Active" is approximated from recent attempts,
// since there's no per-request heartbeat.
export async function siteMetrics(): Promise<SiteMetrics> {
  const reg = await pg`SELECT count(*)::int AS n FROM users WHERE is_anonymous = false AND is_test = false AND is_simulated = false`;
  const anon = await pg`SELECT count(*)::int AS n FROM users WHERE is_anonymous = true AND is_test = false AND is_simulated = false`;
  const activeNow = await pg`
    SELECT count(DISTINCT user_id)::int AS n FROM attempts
    WHERE served_at > now() - interval '15 minutes'
  `;
  const activeToday = await pg`
    SELECT count(DISTINCT user_id)::int AS n FROM attempts
    WHERE served_at > now() - interval '24 hours'
  `;
  const signups = await pg`
    SELECT
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS d1,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int  AS d7
    FROM users WHERE is_anonymous = false AND is_test = false AND is_simulated = false
  `;
  const newAnon = await pg`
    SELECT
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS d1,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int  AS d7
    FROM users WHERE is_anonymous = true AND is_test = false AND is_simulated = false
  `;
  // True anon->registered conversion isn't directly measurable: the upgrade reuses the same
  // user row without recording that it was once anonymous. So we report a related, honest proxy:
  // registered users who have actually practised (have attempts), vs. those who only signed up.
  const practisedRegistered = await pg`
    SELECT count(DISTINCT u.id)::int AS n FROM users u
    JOIN attempts a ON a.user_id = u.id
    WHERE u.is_anonymous = false AND u.is_test = false AND u.is_simulated = false
  `;
  return {
    registeredUsers: reg[0]?.n ?? 0,
    anonymousUsers: anon[0]?.n ?? 0,
    activeNow: activeNow[0]?.n ?? 0,
    activeToday: activeToday[0]?.n ?? 0,
    signups24h: (signups[0] as { d1: number })?.d1 ?? 0,
    signups7d: (signups[0] as { d7: number })?.d7 ?? 0,
    newAnon24h: (newAnon[0] as { d1: number })?.d1 ?? 0,
    newAnon7d: (newAnon[0] as { d7: number })?.d7 ?? 0,
    practisedRegistered: practisedRegistered[0]?.n ?? 0
  };
}

export interface CategoryDifficulty {
  slug: string;
  name: string;
  attempts: number;
  accuracy: number | null;
  avgLevelReached: number | null;
  medianObservedMs: number | null;
  tunedMedianMs: number | null;
  medianDriftPct: number | null; // observed vs hand-tuned guess
}

export async function categoryDifficulty(): Promise<CategoryDifficulty[]> {
  const rows = await pg`
    SELECT c.slug, c.name,
           count(a.id)::int AS attempts,
           avg((a.correct::int)::float) AS accuracy,
           avg(s.stable_level) AS avg_level,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY ch.observed_median_ms) AS obs_med,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY (ch.scoring_config->>'expectedMedianMs')::numeric) AS tuned_med
    FROM categories c
    LEFT JOIN attempts a ON a.category_slug = c.slug AND a.status = 'answered'
    LEFT JOIN challenges ch ON ch.category_slug = c.slug AND ch.observed_median_ms IS NOT NULL
    LEFT JOIN user_category_state s ON s.category_slug = c.slug
    WHERE c.active
    GROUP BY c.slug, c.name, c.sort
    ORDER BY c.sort
  `;
  return rows.map((r: Record<string, unknown>) => {
    const obs = r.obs_med != null ? Math.round(Number(r.obs_med)) : null;
    const tuned = r.tuned_med != null ? Math.round(Number(r.tuned_med)) : null;
    const drift = obs != null && tuned != null && tuned > 0
      ? Math.round(((obs - tuned) / tuned) * 100) : null;
    return {
      slug: r.slug as string,
      name: r.name as string,
      attempts: (r.attempts as number) ?? 0,
      accuracy: r.accuracy != null ? Math.round((r.accuracy as number) * 100) : null,
      avgLevelReached: r.avg_level != null ? Math.round((r.avg_level as number) * 10) / 10 : null,
      medianObservedMs: obs,
      tunedMedianMs: tuned,
      medianDriftPct: drift
    };
  });
}

export interface DistributionBin { rating: number; count: number }

export async function ratingDistributionAdmin(filters: AttributeFilter): Promise<{ bins: DistributionBin[]; summary: Summary; suppressed: boolean }> {
  const minCell = adminConfig.minCell();
  const where = buildAttributeWhere(filters);
  const rows = await pg`
    SELECT avg_rating FROM (
      SELECT u.id, avg(s.rating)::int AS avg_rating
      FROM user_category_state s
      JOIN users u ON u.id = s.user_id
      ${needsAttrJoin(filters) ? pg`JOIN user_attributes at ON at.user_id = u.id AND at.consented_stats = true` : pg``}
      WHERE s.attempts_count >= 10 AND s.rating > 0
        AND ${poolPredicate()}
        ${where}
      GROUP BY u.id
    ) per_user
  `;
  const vals = rows.map((r: { avg_rating: number }) => r.avg_rating);
  if (vals.length < minCell) {
    return { bins: [], summary: summarize([]), suppressed: true };
  }
  const bins: Record<number, number> = {};
  for (const v of vals) {
    const b = Math.floor((v - 600) / 50) * 50 + 600;
    bins[b] = (bins[b] ?? 0) + 1;
  }
  return {
    bins: Object.entries(bins).map(([rating, count]) => ({ rating: Number(rating), count: count as number })).sort((a, b) => a.rating - b.rating),
    summary: summarize(vals),
    suppressed: false
  };
}

// ---------------------------------------------------------------------------
// Attribute filtering (consent-gated)
// ---------------------------------------------------------------------------

export interface AttributeFilter {
  ageBand?: string | null;
  country?: string | null;
  gender?: string | null;
  education?: string | null;
  nativeLanguage?: string | null;
  handedness?: string | null;
}

function needsAttrJoin(f: AttributeFilter): boolean {
  return !!(f.ageBand || f.country || f.gender || f.education || f.nativeLanguage || f.handedness);
}

function buildAttributeWhere(f: AttributeFilter) {
  const parts = [];
  if (f.ageBand) parts.push(pg`AND at.age_band = ${f.ageBand}`);
  if (f.country) parts.push(pg`AND lower(at.country) = lower(${f.country})`);
  if (f.gender) parts.push(pg`AND at.gender = ${f.gender}`);
  if (f.education) parts.push(pg`AND at.education = ${f.education}`);
  if (f.nativeLanguage) parts.push(pg`AND lower(at.native_language) = lower(${f.nativeLanguage})`);
  if (f.handedness) parts.push(pg`AND at.handedness = ${f.handedness}`);
  // combine into one fragment
  return parts.reduce((acc, p) => pg`${acc} ${p}`, pg``);
}

/** Verbal-by-native-language bias check: rating summary per language group,
 *  consented only, suppressed below the floor. Surfaced by default. */
export async function verbalLanguageCheck(): Promise<{ language: string; summary: Summary }[]> {
  const minCell = adminConfig.minCell();
  const rows = await pg`
    SELECT at.native_language AS lang, s.rating
    FROM user_category_state s
    JOIN users u ON u.id = s.user_id
    JOIN user_attributes at ON at.user_id = u.id AND at.consented_stats = true
    WHERE s.category_slug = 'verbal_reasoning' AND s.attempts_count >= 10 AND s.rating > 0
      AND at.native_language IS NOT NULL
      AND ${poolPredicate()}
  `;
  const byLang: Record<string, number[]> = {};
  for (const r of rows as { lang: string; rating: number }[]) {
    const k = r.lang.toLowerCase();
    (byLang[k] ??= []).push(r.rating);
  }
  return Object.entries(byLang)
    .filter(([, vals]) => vals.length >= minCell)
    .map(([language, vals]) => ({ language, summary: summarize(vals) }))
    .sort((a, b) => (b.summary.mean ?? 0) - (a.summary.mean ?? 0));
}

/** Available filter option values (only those that clear the floor, consented). */
export async function filterOptions(): Promise<Record<string, string[]>> {
  const minCell = adminConfig.minCell();
  const fields = ['country', 'gender', 'education', 'native_language', 'handedness'];
  const out: Record<string, string[]> = {};
  for (const field of fields) {
    const rows = await pg`
      SELECT ${pg(field)} AS v, count(*)::int AS n
      FROM user_attributes at JOIN users u ON u.id = at.user_id
      WHERE at.consented_stats = true AND ${pg(field)} IS NOT NULL AND ${poolPredicate()}
      GROUP BY ${pg(field)} HAVING count(*) >= ${minCell}
      ORDER BY count(*) DESC
    `;
    out[field] = rows.map((r: { v: string }) => r.v);
  }
  return out;
}

export interface TemporalTrend {
  byHour: { hour: number; n: number; accuracy: number; avgScore: number }[];
  byDow: { dow: number; n: number; accuracy: number; avgScore: number }[];
  byMonth: { month: number; n: number; accuracy: number; avgScore: number }[];
}

/** Aggregate temporal trends across the (filtered) population. Faceless. */
export async function temporalTrends(filters: AttributeFilter): Promise<TemporalTrend> {
  const minCell = adminConfig.minCell();
  const where = buildAttributeWhere(filters);
  const join = needsAttrJoin(filters)
    ? pg`JOIN user_attributes at ON at.user_id = u.id AND at.consented_stats = true`
    : pg``;

  const grab = async (col: string) => {
    // col is from a fixed internal allowlist (see call sites below), never user
    // input. postgres.js escapes a dotted identifier `a.col` as one qualified
    // column; passing ('a', col) instead would emit "a","col" - two columns - and
    // produce a syntax error, which is the bug this replaces.
    const ident = pg(`a.${col}`);
    const rows = await pg`
      SELECT ${ident} AS k, count(*)::int AS n,
             avg((a.correct::int)::float) AS accuracy, avg(a.score) AS avg_score
      FROM attempts a JOIN users u ON u.id = a.user_id ${join}
      WHERE a.status = 'answered' AND ${ident} IS NOT NULL AND ${poolPredicate()} ${where}
      GROUP BY ${ident} HAVING count(*) >= ${minCell}
      ORDER BY ${ident}
    `;
    return rows.map((r: Record<string, unknown>) => ({
      k: r.k as number, n: r.n as number,
      accuracy: Math.round((r.accuracy as number) * 100),
      avgScore: Math.round((r.avg_score as number) * 100) / 100
    }));
  };

  const [h, d, m] = await Promise.all([grab('local_hour'), grab('local_dow'), grab('local_month')]);
  return {
    byHour: h.map((x) => ({ hour: x.k, n: x.n, accuracy: x.accuracy, avgScore: x.avgScore })),
    byDow: d.map((x) => ({ dow: x.k, n: x.n, accuracy: x.accuracy, avgScore: x.avgScore })),
    byMonth: m.map((x) => ({ month: x.k, n: x.n, accuracy: x.accuracy, avgScore: x.avgScore }))
  };
}

/**
 * Inter-category correlation matrix: do categories measure distinct things, or
 * are some redundant? Pearson r between users' ratings across category pairs,
 * using only users rated in both. High r (>0.8) on a pair suggests they collapse
 * to one factor - evidence the domains aren't empirically distinct.
 */
export async function categoryCorrelations(): Promise<{
  categories: string[];
  matrix: (number | null)[][];
  highPairs: { a: string; b: string; r: number; n: number }[];
}> {
  const includeSim = flags.simulatedUsers();
  const rows = await pg`
    SELECT s.user_id, s.category_slug, s.rating
    FROM user_category_state s
    JOIN users u ON u.id = s.user_id
    WHERE s.attempts_count >= 10 AND s.rating > 0
      AND u.is_anonymous = false AND u.is_test = false AND (u.is_simulated = false OR ${includeSim})
  `;
  const byUser: Record<string, Record<string, number>> = {};
  const catsSet = new Set<string>();
  for (const r of rows as { user_id: string; category_slug: string; rating: number }[]) {
    (byUser[r.user_id] ??= {})[r.category_slug] = r.rating;
    catsSet.add(r.category_slug);
  }
  const categories = Array.from(catsSet).sort();
  const minCell = adminConfig.minCell();

  const pearson = (pairs: [number, number][]): number | null => {
    const n = pairs.length;
    if (n < minCell) return null;
    const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
    const my = pairs.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (const [x, y] of pairs) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
    return dx > 0 && dy > 0 ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null;
  };

  const matrix: (number | null)[][] = [];
  const highPairs: { a: string; b: string; r: number; n: number }[] = [];
  for (let i = 0; i < categories.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < categories.length; j++) {
      if (i === j) { matrix[i][j] = 1; continue; }
      const pairs: [number, number][] = [];
      for (const u of Object.values(byUser)) {
        if (u[categories[i]] != null && u[categories[j]] != null) pairs.push([u[categories[i]], u[categories[j]]]);
      }
      const r = pearson(pairs);
      matrix[i][j] = r;
      if (i < j && r != null && r >= 0.8) highPairs.push({ a: categories[i], b: categories[j], r, n: pairs.length });
    }
  }
  return { categories, matrix, highPairs };
}

/** Consenter-vs-non-consenter bias: compares the two groups on variables we have
 *  for BOTH (here: whether they're rated, and mean attempts) to quantify selection bias. */
export async function consentBiasReport(): Promise<{
  consentedN: number; nonConsentedN: number;
  ratedRateConsented: number | null; ratedRateNon: number | null; gap: number | null;
}> {
  const includeSim = flags.simulatedUsers();
  const rows = await pg`
    SELECT
      coalesce(at.consented_stats, false) AS consented,
      (EXISTS (SELECT 1 FROM user_category_state s WHERE s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0)) AS rated
    FROM users u
    LEFT JOIN user_attributes at ON at.user_id = u.id
    WHERE u.is_anonymous = false AND u.is_test = false AND (u.is_simulated = false OR ${includeSim})
  `;
  let cN = 0, cRated = 0, nN = 0, nRated = 0;
  for (const r of rows as { consented: boolean; rated: boolean }[]) {
    if (r.consented) { cN++; if (r.rated) cRated++; }
    else { nN++; if (r.rated) nRated++; }
  }
  const minCell = adminConfig.minCell();
  const cr = cN >= minCell ? Math.round((cRated / cN) * 1000) / 1000 : null;
  const nr = nN >= minCell ? Math.round((nRated / nN) * 1000) / 1000 : null;
  return {
    consentedN: cN, nonConsentedN: nN,
    ratedRateConsented: cr, ratedRateNon: nr,
    gap: cr != null && nr != null ? Math.round((cr - nr) * 1000) / 1000 : null
  };
}

/** External-criterion validity: correlate users' mean Excogni rating against a
 *  self-reported external test score (consented, same test type). The first real
 *  evidence of VALIDITY rather than mere consistency. Suppressed below the floor. */
export async function externalValidity(): Promise<{ testType: string; n: number; r: number | null }[]> {
  const minCell = adminConfig.minCell();
  const rows = await pg`
    SELECT at.ext_test_type AS t, at.ext_test_score AS score, avg(s.rating)::float AS rating
    FROM user_attributes at
    JOIN users u ON u.id = at.user_id
    JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0
    WHERE at.consented_stats = true AND at.ext_test_type IS NOT NULL AND at.ext_test_score IS NOT NULL
    GROUP BY at.ext_test_type, at.ext_test_score, u.id
  `;
  const byType: Record<string, [number, number][]> = {};
  for (const r of rows as { t: string; score: number; rating: number }[]) {
    (byType[r.t] ??= []).push([r.score, r.rating]);
  }
  const pearson = (pairs: [number, number][]): number | null => {
    const n = pairs.length;
    if (n < minCell) return null;
    const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
    const my = pairs.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (const [x, y] of pairs) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
    return dx > 0 && dy > 0 ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null;
  };
  return Object.entries(byType).map(([testType, pairs]) => ({
    testType, n: pairs.length, r: pearson(pairs)
  }));
}

/** Practice-effect visibility: compares each user's rating in their EARLY
 *  sessions vs LATE sessions. A systematic rise means the rating reflects
 *  practice/learning as much as a stable trait - essential to surface, because
 *  the product trains as it measures. Aggregated, suppressed below floor. */
export async function practiceEffect(): Promise<{ category: string; earlyMean: number | null; lateMean: number | null; gain: number | null; n: number }[]> {
  const minCell = adminConfig.minCell();
  const includeSim = flags.simulatedUsers();
  // first vs last rating_history point per user per category
  const rows = await pg`
    WITH ordered AS (
      SELECT rh.user_id, rh.category_slug, rh.rating, rh.recorded_at,
             row_number() OVER (PARTITION BY rh.user_id, rh.category_slug ORDER BY rh.recorded_at ASC) AS rn_asc,
             row_number() OVER (PARTITION BY rh.user_id, rh.category_slug ORDER BY rh.recorded_at DESC) AS rn_desc,
             count(*) OVER (PARTITION BY rh.user_id, rh.category_slug) AS total
      FROM rating_history rh
      JOIN users u ON u.id = rh.user_id
      WHERE u.is_anonymous = false AND u.is_test = false AND (u.is_simulated = false OR ${includeSim})
    )
    SELECT category_slug,
           avg(CASE WHEN rn_asc = 1 THEN rating END) AS early,
           avg(CASE WHEN rn_desc = 1 THEN rating END) AS late,
           count(DISTINCT user_id) FILTER (WHERE total >= 5) AS n
    FROM ordered
    WHERE total >= 5
    GROUP BY category_slug
  `;
  return rows.map((r: Record<string, unknown>) => {
    const n = Number(r.n ?? 0);
    if (n < minCell) return { category: r.category_slug as string, earlyMean: null, lateMean: null, gain: null, n };
    const early = r.early != null ? Math.round(Number(r.early)) : null;
    const late = r.late != null ? Math.round(Number(r.late)) : null;
    return {
      category: r.category_slug as string,
      earlyMean: early, lateMean: late,
      gain: early != null && late != null ? late - early : null,
      n
    };
  });
}

/** Recent server errors for the admin Health panel. Capped; newest first. */
export async function recentErrors(limit = 50): Promise<{
  id: string; occurredAt: string; route: string | null; message: string;
  status: number | null; userKind: string | null; seen: boolean;
}[]> {
  const rows = await pg`
    SELECT id, occurred_at, route, message, status, user_kind, seen
    FROM error_log ORDER BY occurred_at DESC LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    occurredAt: (r.occurred_at as Date).toISOString(),
    route: (r.route as string) ?? null,
    message: r.message as string,
    status: (r.status as number) ?? null,
    userKind: (r.user_kind as string) ?? null,
    seen: r.seen as boolean
  }));
}

/** Error counts: total, unseen, and last 24h - a quick health pulse. */
export async function errorPulse(): Promise<{ total: number; unseen: number; last24h: number }> {
  const rows = await pg`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE seen = false)::int AS unseen,
      count(*) FILTER (WHERE occurred_at > now() - interval '24 hours')::int AS last24h
    FROM error_log
  `;
  return { total: rows[0]?.total ?? 0, unseen: rows[0]?.unseen ?? 0, last24h: rows[0]?.last24h ?? 0 };
}

/** Recent user feedback for the admin Health panel. */
export async function recentFeedback(limit = 50): Promise<{
  id: string; createdAt: string; route: string | null; kind: string | null; message: string;
  resolved: boolean; snapshot: unknown; image: string | null;
}[]> {
  const rows = await pg`
    SELECT id, created_at, route, kind, message, resolved, snapshot, image
    FROM feedback ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    createdAt: (r.created_at as Date).toISOString(),
    route: (r.route as string) ?? null,
    kind: (r.kind as string) ?? null,
    message: r.message as string,
    snapshot: r.snapshot ?? null,
    image: (r.image as string) ?? null,
    resolved: r.resolved as boolean
  }));
}
