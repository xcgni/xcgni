// Public statistics - the aggregate picture, open to everyone.
// Hard rules, identical in spirit to the admin export:
//  - CONSENT: only users who consented to aggregate research are counted
//    (consented_stats lives on user_attributes, joined as `ua`).
//  - SUPPRESSION: any group below the min-cell floor is withheld (null), so no
//    individual can be singled out.
//  - NO per-user data, NO attribute filtering, NO drill-down. Population only.
// Simulated reference users are excluded here (this is the *real* public picture).

import { pg } from '$lib/server/db';
import { adminConfig } from '$lib/server/flags';
import { cached } from '$lib/server/cache';

// Public aggregates are cached briefly: identical under load, invisible staleness.
// All five entry points below are thin cache wrappers over the real query functions.
const TTL = 60_000;
import { suppressCount } from '$lib/server/admin/stats';

// Consent + real-user predicate. consented_stats is on user_attributes (ua);
// is_anonymous/test/simulated are on users (u). In preview mode, simulated users are
// included (for demoing the page before real users exist) - the page labels this clearly.
function consentPredicate(preview: boolean) {
  return preview
    ? pg`ua.consented_stats = true AND u.is_anonymous = false AND u.is_test = false`
    : pg`ua.consented_stats = true AND u.is_anonymous = false AND u.is_test = false AND u.is_simulated = false`;
}

export interface TrendPoint {
  week: string;          // 'YYYY-MM-DD' (Monday of the ISO week)
  cumulativeUsers: number;
  activeUsers: number;   // distinct consented users active that week
  attempts: number;
  medianRating: number | null;
}
export interface PublicTrends {
  enoughData: boolean;
  points: TrendPoint[];
  totalUsers: number;
}

// Community trends over time, weekly. Honest framing: growth and activity are clean; the median
// rating line is shown but is confounded by WHO joined when (new users haven't calibrated), so the
// UI labels it carefully. Consent-gated and only returned once the community clears the floor.
export async function publicTrends(preview = false): Promise<PublicTrends> {
  return cached(`pt:${preview}`, TTL, () => _publicTrends(preview));
}
async function _publicTrends(preview = false): Promise<PublicTrends> {
  const minCell = adminConfig.publicMinCell();
  const REAL_CONSENTED = consentPredicate(preview);

  // total consented users, to decide whether to show anything at all
  const totalRows = await pg`
    SELECT count(*)::int AS n
    FROM users u JOIN user_attributes ua ON ua.user_id = u.id
    WHERE ${REAL_CONSENTED}
  `;
  const total = (totalRows as { n: number }[])[0]?.n ?? 0;
  if (suppressCount(total, minCell) == null) {
    return { enoughData: false, points: [], totalUsers: 0 };
  }

  // weekly new consented users (signup cohort) -> we'll make cumulative in JS
  const signups = await pg`
    SELECT to_char(date_trunc('week', u.created_at), 'YYYY-MM-DD') AS week, count(*)::int AS n
    FROM users u JOIN user_attributes ua ON ua.user_id = u.id
    WHERE ${REAL_CONSENTED}
    GROUP BY 1 ORDER BY 1
  `;
  // weekly activity: distinct active consented users + attempts
  const activity = await pg`
    SELECT to_char(date_trunc('week', a.served_at), 'YYYY-MM-DD') AS week,
           count(DISTINCT a.user_id)::int AS active,
           count(*)::int AS attempts
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN user_attributes ua ON ua.user_id = u.id
    WHERE a.status = 'answered' AND ${REAL_CONSENTED}
    GROUP BY 1 ORDER BY 1
  `;
  // weekly median rating across consented users' current ratings, by when the rating was recorded
  const ratings = await pg`
    SELECT week, percentile_cont(0.5) WITHIN GROUP (ORDER BY rating) AS med
    FROM (
      SELECT to_char(date_trunc('week', rh.recorded_at), 'YYYY-MM-DD') AS week, rh.rating
      FROM rating_history rh
      JOIN users u ON u.id = rh.user_id
      JOIN user_attributes ua ON ua.user_id = u.id
      WHERE rh.rating > 0 AND ${REAL_CONSENTED}
    ) x GROUP BY week ORDER BY week
  `;

  // merge by week
  const weeks = new Set<string>();
  const signupMap = new Map<string, number>();
  for (const r of signups as { week: string; n: number }[]) { signupMap.set(r.week, r.n); weeks.add(r.week); }
  const actMap = new Map<string, { active: number; attempts: number }>();
  for (const r of activity as { week: string; active: number; attempts: number }[]) { actMap.set(r.week, { active: r.active, attempts: r.attempts }); weeks.add(r.week); }
  const ratMap = new Map<string, number>();
  for (const r of ratings as { week: string; med: number | null }[]) { if (r.med != null) ratMap.set(r.week, Math.round(Number(r.med))); weeks.add(r.week); }

  const ordered = [...weeks].sort();
  let cum = 0;
  const points: TrendPoint[] = ordered.map((week) => {
    cum += signupMap.get(week) ?? 0;
    const act = actMap.get(week);
    return {
      week,
      cumulativeUsers: cum,
      activeUsers: act?.active ?? 0,
      attempts: act?.attempts ?? 0,
      medianRating: ratMap.get(week) ?? null
    };
  });

  return { enoughData: points.length >= 2, points, totalUsers: total };
}

export interface PublicBehavioral {
  enoughData: boolean;
  minCell: number;
  preview: boolean;
  // persistence (consistency of showing up) - population medians
  medianActiveDays: number | null;
  medianDaysLast30: number | null;
  persistenceUsers: number | null;
  // spelling accuracy - population median %
  medianSpellingPct: number | null;
  spellingUsers: number | null;
}

// Population-level view of the BEHAVIOURAL traits (persistence, spelling), kept separate from the
// cognitive ratings because they are a different kind of thing - self-determined behaviour, not
// measured cognition. Same consent + suppression discipline: nothing shown unless the consented
// pool clears the floor.
export async function publicBehavioral(preview = false): Promise<PublicBehavioral> {
  return cached(`pb:${preview}`, TTL, () => _publicBehavioral(preview));
}
async function _publicBehavioral(preview = false): Promise<PublicBehavioral> {
  const minCell = adminConfig.minCell();
  const REAL_CONSENTED = consentPredicate(preview);

  // persistence: per consented user, distinct active days + days in last 30
  const persistRows = await pg`
    WITH per_user AS (
      SELECT u.id,
             count(DISTINCT to_char(a.served_at, 'YYYY-MM-DD'))::int AS active_days,
             count(DISTINCT to_char(a.served_at, 'YYYY-MM-DD')) FILTER (WHERE a.served_at > now() - interval '30 days')::int AS days_30
      FROM users u
      JOIN user_attributes ua ON ua.user_id = u.id
      JOIN attempts a ON a.user_id = u.id AND a.status = 'answered'
      WHERE ${REAL_CONSENTED}
      GROUP BY u.id
    )
    SELECT count(*)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY active_days) AS med_days,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY days_30) AS med_30
    FROM per_user
  `;
  const pr = (persistRows as { n: number; med_days: number | null; med_30: number | null }[])[0];
  const persistenceUsers = suppressCount(pr?.n ?? 0, minCell);

  // spelling: median clean-% across consented users with enough typed words
  const spellRows = await pg`
    WITH per_user AS (
      SELECT us.user_id,
             (us.typed_words - us.typo_words)::float / NULLIF(us.typed_words, 0) AS clean
      FROM user_spelling us
      JOIN user_attributes ua ON ua.user_id = us.user_id
      JOIN users u ON u.id = us.user_id
      WHERE ${REAL_CONSENTED} AND us.typed_words >= 20
    )
    SELECT count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY clean) AS med_clean
    FROM per_user
  `;
  const sr = (spellRows as { n: number; med_clean: number | null }[])[0];
  const spellingUsers = suppressCount(sr?.n ?? 0, minCell);

  return {
    enoughData: persistenceUsers != null || spellingUsers != null,
    minCell,
    preview,
    medianActiveDays: persistenceUsers != null && pr?.med_days != null ? Math.round(Number(pr.med_days)) : null,
    medianDaysLast30: persistenceUsers != null && pr?.med_30 != null ? Math.round(Number(pr.med_30)) : null,
    persistenceUsers,
    medianSpellingPct: spellingUsers != null && sr?.med_clean != null ? Math.round(Number(sr.med_clean) * 100) : null,
    spellingUsers
  };
}

export interface PublicStats {
  ratedUsers: number | null;        // null if below the floor
  enoughData: boolean;              // false until the pool clears suppression
  minCell: number;
  preview: boolean;                 // true if simulated users are included (demo mode)
  distribution: { rating: number; count: number }[]; // binned, empty if suppressed
  overall: { median: number | null; iqr: [number, number] | null } | null;
  categories: { slug: string; name: string; medianRating: number | null; q1: number | null; q3: number | null; n: number | null }[];
}

export async function publicStats(preview = false): Promise<PublicStats> {
  return cached(`ps:${preview}`, TTL, () => _publicStats(preview));
}
async function _publicStats(preview = false): Promise<PublicStats> {
  const minCell = adminConfig.minCell();
  const REAL_CONSENTED = consentPredicate(preview);

  // how many consented, rated real users are there?
  const rated = await pg`
    SELECT count(DISTINCT u.id)::int AS n
    FROM users u
    JOIN user_attributes ua ON ua.user_id = u.id
    JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0
    WHERE ${REAL_CONSENTED}
  `;
  const ratedUsers = suppressCount(rated[0]?.n ?? 0, minCell);
  const enoughData = ratedUsers != null;

  if (!enoughData) {
    return { ratedUsers, enoughData: false, minCell, preview, distribution: [], overall: null, categories: [] };
  }

  // each user's overall rating = mean of their category ratings (consented real users)
  const overallCTE = pg`
    SELECT u.id, avg(s.rating)::numeric AS rating
    FROM users u
    JOIN user_attributes ua ON ua.user_id = u.id
    JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0
    WHERE ${REAL_CONSENTED}
    GROUP BY u.id
  `;

  const dist = await pg`
    WITH user_overall AS (${overallCTE})
    SELECT (floor(rating / 50) * 50)::int AS bin, count(*)::int AS n
    FROM user_overall GROUP BY bin ORDER BY bin
  `;
  const distribution = dist.map((r: { bin: number; n: number }) => ({ rating: r.bin, count: r.n }));

  const stats = await pg`
    WITH user_overall AS (${overallCTE})
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY rating) AS median,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY rating) AS q1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY rating) AS q3
    FROM user_overall
  `;
  const overall = stats[0]?.median != null
    ? {
        median: Math.round(Number(stats[0].median)),
        iqr: [Math.round(Number(stats[0].q1)), Math.round(Number(stats[0].q3))] as [number, number]
      }
    : null;

  // per-category public medians, each independently suppressed
  const cats = await pg`
    SELECT c.slug, c.name,
           count(DISTINCT s.user_id)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY s.rating) AS median_rating,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY s.rating) AS q1,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY s.rating) AS q3
    FROM categories c
    JOIN user_category_state s ON s.category_slug = c.slug AND s.attempts_count >= 10 AND s.rating > 0
    JOIN users u ON u.id = s.user_id
    JOIN user_attributes ua ON ua.user_id = u.id
    WHERE c.active AND ${REAL_CONSENTED}
    GROUP BY c.slug, c.name, c.sort
    ORDER BY c.sort
  `;
  const categories = cats.map((r: { slug: string; name: string; n: number; median_rating: number | null; q1: number | null; q3: number | null }) => {
    const n = suppressCount(r.n, minCell);
    const shown = n != null;
    return {
      slug: r.slug, name: r.name, n,
      medianRating: shown && r.median_rating != null ? Math.round(Number(r.median_rating)) : null,
      q1: shown && r.q1 != null ? Math.round(Number(r.q1)) : null,
      q3: shown && r.q3 != null ? Math.round(Number(r.q3)) : null
    };
  });

  return { ratedUsers, enoughData: true, minCell, preview, distribution, overall, categories };
}

// ---------------------------------------------------------------------------
// Extensive public breakdowns - slice the consented population by one dimension.
// Every returned group is independently suppressed below the PUBLIC floor (>= admin
// floor, default 50), so an openly filterable/exportable surface still never exposes a
// small group. Differencing across cuts is a known limitation (see DOCUMENTATION.md);
// v1 offers single-dimension breakdowns rather than arbitrary nested filters to limit it.

export type BreakdownDim = 'age_band' | 'country' | 'education' | 'native_language' | 'handedness';

// Each filterable dimension maps to its user_attributes column. Used for both the group-by
// and the filter constraints. Values are matched exactly (the dropdowns supply canonical values).
const DIM_COLUMN: Record<BreakdownDim, string> = {
  age_band: 'age_band',
  country: 'country',
  education: 'education',
  native_language: 'native_language',
  handedness: 'handedness'
};

export interface ExploreFilter {
  dimension: BreakdownDim;
  value: string;
}

export interface ExploreRow {
  group: string;
  n: number;                       // always >= public floor (suppressed rows omitted)
  medianRating: number | null;
  q1: number | null;
  q3: number | null;
}

export interface PublicExplore {
  groupBy: BreakdownDim;
  filters: ExploreFilter[];
  category: string | null;         // null = overall (mean across categories)
  minCell: number;
  preview: boolean;
  rows: ExploreRow[];
  suppressedGroups: number;
  totalMatched: number;            // consented users matching the filters (>= floor or 0)
}

// The powerful, multi-filter public explorer. Slice the consented population by a group-by
// dimension AND any number of filter constraints (e.g. group by country, filtered to women
// 25-34 with a master's), optionally within a single cognitive category. EVERY final group is
// independently suppressed below the public floor (>=50) - so however the population is sliced,
// a group smaller than the floor is NEVER shown. This is what makes powerful filtering safe.
export async function publicExplore(
  groupBy: BreakdownDim,
  filters: ExploreFilter[],
  category: string | null,
  preview = false
): Promise<PublicExplore> {
  const key = `pe:${preview}:${groupBy}:${category ?? ''}:` +
    filters.map((f) => `${f.dimension}=${f.value}`).sort().join('|');
  return cached(key, TTL, () => _publicExplore(groupBy, filters, category, preview));
}
async function _publicExplore(
  groupBy: BreakdownDim,
  filters: ExploreFilter[],
  category: string | null,
  preview = false
): Promise<PublicExplore> {
  const minCell = adminConfig.publicMinCell();
  const REAL_CONSENTED = consentPredicate(preview);

  // group-by expression
  const groupCol = DIM_COLUMN[groupBy] ?? 'country';
  const groupExpr = pg`COALESCE(ua.${pg(groupCol)}, 'unknown')`;

  // filter predicates: AND each dimension=value (validated columns only)
  let whereFilters = pg``;
  for (const f of filters) {
    const col = DIM_COLUMN[f.dimension];
    if (!col) continue;                       // ignore unknown dims
    if (!f.value) continue;                    // ignore empty
    whereFilters = pg`${whereFilters} AND ua.${pg(col)} = ${f.value}`;
  }

  // category scope: a specific category's rating, or overall mean across categories
  const ratingSource = category
    ? pg`AND s.category_slug = ${category}`
    : pg``;

  const rows = await pg`
    WITH user_grp AS (
      SELECT u.id, ${groupExpr} AS grp, avg(s.rating)::numeric AS rating
      FROM users u
      JOIN user_attributes ua ON ua.user_id = u.id
      JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0 ${ratingSource}
      WHERE ${REAL_CONSENTED} ${whereFilters}
      GROUP BY u.id, grp
    )
    SELECT grp,
           count(*)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rating) AS median,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY rating) AS q1,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY rating) AS q3
    FROM user_grp
    GROUP BY grp
    ORDER BY n DESC
  `;

  const kept: ExploreRow[] = [];
  let suppressedGroups = 0;
  let totalMatched = 0;
  for (const r of rows as { grp: string; n: number; median: number | null; q1: number | null; q3: number | null }[]) {
    totalMatched += r.n;
    if (r.n < minCell) { suppressedGroups++; continue; }   // strict per-group k-anonymity
    kept.push({
      group: r.grp,
      n: r.n,
      medianRating: r.median != null ? Math.round(Number(r.median)) : null,
      q1: r.q1 != null ? Math.round(Number(r.q1)) : null,
      q3: r.q3 != null ? Math.round(Number(r.q3)) : null
    });
  }

  // Don't reveal the matched total if it itself is below the floor (differencing guard):
  // a tiny filtered population shouldn't leak even as a count.
  const safeTotal = totalMatched >= minCell ? totalMatched : 0;

  return { groupBy, filters, category, minCell, preview, rows: kept, suppressedGroups, totalMatched: safeTotal };
}

export interface BreakdownRow {
  group: string;
  n: number;                       // always >= public floor (suppressed rows omitted)
  medianRating: number | null;
  q1: number | null;
  q3: number | null;
}

export interface PublicBreakdown {
  dimension: BreakdownDim;
  minCell: number;                 // the public floor actually applied
  preview: boolean;
  rows: BreakdownRow[];            // only groups clearing the floor
  suppressedGroups: number;        // how many groups were withheld for being too small
}

// IMPORTANT: build these SQL fragments lazily inside the function. As a module-scope const
// they would call pg`...` at import time, which triggers the DB client during SvelteKit's
// post-build analyse step (no DATABASE_URL) and breaks the build.
function dimExprFor(dimension: BreakdownDim) {
  switch (dimension) {
    case 'age_band': return pg`COALESCE(ua.age_band, 'unknown')`;
    case 'country': return pg`COALESCE(ua.country, 'unknown')`;
    case 'education': return pg`COALESCE(ua.education, 'unknown')`;
    case 'native_language': return pg`COALESCE(ua.native_language, 'unknown')`;
    case 'handedness': return pg`COALESCE(ua.handedness, 'unknown')`;
    default: return pg`COALESCE(ua.country, 'unknown')`;
  }
}

export async function publicBreakdown(dimension: BreakdownDim, preview = false): Promise<PublicBreakdown> {
  return cached(`pk:${preview}:${dimension}`, TTL, () => _publicBreakdown(dimension, preview));
}
async function _publicBreakdown(dimension: BreakdownDim, preview = false): Promise<PublicBreakdown> {
  const minCell = adminConfig.publicMinCell();
  const REAL_CONSENTED = consentPredicate(preview);
  const dimExpr = dimExprFor(dimension);

  // each user's overall rating = mean of their rated category ratings, with their group
  const rows = await pg`
    WITH user_overall AS (
      SELECT u.id, ${dimExpr} AS grp, avg(s.rating)::numeric AS rating
      FROM users u
      JOIN user_attributes ua ON ua.user_id = u.id
      JOIN user_category_state s ON s.user_id = u.id AND s.attempts_count >= 10 AND s.rating > 0
      WHERE ${REAL_CONSENTED}
      GROUP BY u.id, grp
    )
    SELECT grp,
           count(*)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rating) AS median,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY rating) AS q1,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY rating) AS q3
    FROM user_overall
    GROUP BY grp
    ORDER BY n DESC
  `;

  const kept: BreakdownRow[] = [];
  let suppressedGroups = 0;
  for (const r of rows as { grp: string; n: number; median: number | null; q1: number | null; q3: number | null }[]) {
    if (r.n < minCell) { suppressedGroups++; continue; }   // k-anonymity per group
    kept.push({
      group: r.grp,
      n: r.n,
      medianRating: r.median != null ? Math.round(Number(r.median)) : null,
      q1: r.q1 != null ? Math.round(Number(r.q1)) : null,
      q3: r.q3 != null ? Math.round(Number(r.q3)) : null
    });
  }

  return { dimension, minCell, preview, rows: kept, suppressedGroups };
}
