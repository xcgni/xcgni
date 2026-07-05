import type { PageServerLoad } from './$types';
import { pg } from '$lib/server/db';
import {
  userRatings, ratingHistory, userPatterns,
  userRecords, userDomains, userDomainRanges, populationDomainMedians, ratingDistribution, userSessions, userPersistence,
  domainTimeline, domainSparklines, userPercentiles, statsHeadline, userReadiness, bestWorstDays
} from '$lib/server/stats';
import { inhibitionInterference, switchingCost } from '$lib/server/stats/executive';
import { METHODOLOGY_VERSION } from '$lib/methodology';
import { resolveAllFlags } from '$lib/server/runtime-flags';
import { userInsights } from '$lib/server/insights';
import { userSpelling } from '$lib/server/stats/spelling';
import { flags } from '$lib/server/flags';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    return {
      ratings: null, history: [], category: null, patterns: null,
      records: [], domains: [], domainRanges: [], populationMedians: [], distribution: null, executive: null,
      lastSession: null, anonymous: true,
      insights: { state: 'not_enough_data', minSessions: 20, sessionCount: 0, insights: [] },
      persistence: { activeDays: [], totalActiveDays: 0, daysLast30: 0, currentRun: 0, longestRun: 0, firstDay: null, weeks: [] },
      spelling: { typedWords: 0, typoWords: 0, accuracyPct: null, minWords: 20 },
      timeline: [], sparklines: [],
      percentiles: [], headline: { text: 'Practice a little and your stats will appear here.', tone: 'early' },
      readiness: { overallPct: 0, sessions: { have: 0, need: 20 }, calibratedDomains: { have: 0, total: 12 }, insightsReady: false, profile: { pct: 0, complete: false, have: 0, total: 12 }, deep: { pct: 0, ready: false, have: 0, need: 20 }, message: 'Practice a little each day - your profile fills as each ability gets measured.' },
      bestWorst: { best: [], worst: [], qualifyingDays: 0, limited: true },
      methodologyVersion: METHODOLOGY_VERSION,
      simulatedPopulation: false,
      showDebug: false, simulatedPool: false
    };
  }
  const categoryFilter = url.searchParams.get('cat');
  const ratings = await userRatings(locals.user.id);
  const validCat = ratings.categories.find((c) => c.slug === categoryFilter)?.slug ?? null;
  // Retention reviews at a glance: the review schedule was invisible outside sessions.
  const badgePromise = pg`SELECT public_badge FROM user_settings WHERE user_id = ${locals.user.id}`;
  const reviewsPromise = pg`
    SELECT
      count(*) FILTER (WHERE due_at <= now())::int AS due_now,
      count(*) FILTER (WHERE due_at > now() AND due_at <= now() + interval '24 hours')::int AS due_24h,
      count(*) FILTER (WHERE interval_days >= 7)::int AS retained,
      count(*)::int AS seen
    FROM user_card_state WHERE user_id = ${locals.user.id}
  `;
  const [history, patterns, records, domains, domainRanges, populationMedians, distribution, interference, switchCost, sessions, insights, persistence] = await Promise.all([
    ratingHistory(locals.user.id, validCat, 80),
    userPatterns(locals.user.id),
    userRecords(locals.user.id),
    userDomains(locals.user.id),
    userDomainRanges(locals.user.id),
    populationDomainMedians(locals.user.id),
    ratingDistribution(locals.user.id),
    inhibitionInterference(locals.user.id),
    switchingCost(locals.user.id),
    userSessions(locals.user.id, 1),
    userInsights(locals.user.id),
    userPersistence(locals.user.id)
  ]);
  const spelling = await userSpelling(locals.user.id);
  const [timeline, sparklines, percentiles] = await Promise.all([
    domainTimeline(locals.user.id),
    domainSparklines(locals.user.id),
    userPercentiles(locals.user.id)
  ]);
  const headline = statsHeadline(sparklines, percentiles);
  const readiness = await userReadiness(locals.user.id);
  return {
    ratings, history, category: validCat, patterns,
    records, domains, domainRanges, populationMedians, distribution,
    executive: { interference, switchCost },
    lastSession: sessions[0] ?? null,
    insights,
    persistence,
    reviews: (await reviewsPromise)[0] ?? { due_now: 0, due_24h: 0, retained: 0, seen: 0 },
    publicBadge: !!(await badgePromise)[0]?.public_badge,
    spelling,
    timeline,
    sparklines,
    percentiles,
    headline,

    anonymous: locals.user.isAnonymous,
    showDebug: flags.showDebugUi(),
    methodologyVersion: METHODOLOGY_VERSION,
    simulatedPopulation: (await resolveAllFlags().then(() => flags.simulatedUsers())),
    simulatedPool: flags.simulatedUsers()
  };
};
