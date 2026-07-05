import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import {
  populationVitals, categoryDifficulty, ratingDistributionAdmin, verbalLanguageCheck,
  categoryCorrelations, consentBiasReport, externalValidity, practiceEffect, siteMetrics, derivedMetrics, dataQuality
} from '$lib/server/admin/queries';
import { topReferrers, visitTotals } from '$lib/server/ops/visits';
import { testRetestReliability, compare, multipleComparisons, cliffsDelta } from '$lib/server/admin/stats';
import { adminConfig } from '$lib/server/flags';
import { pg } from '$lib/server/db';

export const load: PageServerLoad = async ({ cookies }) => {
  // Defense in depth: the layout gate does not survive refactors (and never covered
  // actions/endpoints); every admin load carries its own awaited check.
  if (!(await isAdmin(cookies))) throw redirect(303, '/admin/login');
  const minCell = adminConfig.minCell();
  const [vitals, categories, distribution, verbalByLang, correlations, consentBias] = await Promise.all([
    populationVitals(),
    categoryDifficulty(),
    ratingDistributionAdmin({}),
    verbalLanguageCheck(),
    categoryCorrelations(),
    consentBiasReport()
  ]);
  const [validity, practice] = await Promise.all([externalValidity(), practiceEffect()]);
  const [site, referrers, visits, derived] = await Promise.all([siteMetrics(), topReferrers(30, 15), visitTotals(), derivedMetrics()]);
  const quality = await dataQuality();

  // Verbal-language: pairwise effect size between the top two language groups,
  // with a multiple-comparisons note (this is exploratory).
  let verbalComparison = null;
  if (verbalByLang.length >= 2) {
    const rowsA = await pg`
      SELECT s.rating FROM user_category_state s
      JOIN users u ON u.id = s.user_id
      JOIN user_attributes at ON at.user_id = u.id AND at.consented_stats = true
      WHERE s.category_slug = 'verbal_reasoning' AND s.attempts_count >= 10 AND s.rating > 0
        AND lower(at.native_language) = ${verbalByLang[0].language}
    `;
    const rowsB = await pg`
      SELECT s.rating FROM user_category_state s
      JOIN users u ON u.id = s.user_id
      JOIN user_attributes at ON at.user_id = u.id AND at.consented_stats = true
      WHERE s.category_slug = 'verbal_reasoning' AND s.attempts_count >= 10 AND s.rating > 0
        AND lower(at.native_language) = ${verbalByLang[1].language}
    `;
    const cmp = compare(
      rowsA.map((r: { rating: number }) => r.rating),
      rowsB.map((r: { rating: number }) => r.rating),
      minCell
    );
    verbalComparison = {
      langA: verbalByLang[0].language, langB: verbalByLang[1].language,
      ...cmp,
      mc: multipleComparisons(verbalByLang.length * (verbalByLang.length - 1) / 2)
    };
  }

  // Test-retest reliability per category: needs users with repeated ratings.
  // We approximate "repeats" by consecutive rating_history points per user.
  const reliabilityRows = await pg`
    SELECT category_slug, user_id, rating
    FROM rating_history
    ORDER BY category_slug, user_id, recorded_at
  `;
  const byCat: Record<string, Record<string, number[]>> = {};
  for (const r of reliabilityRows as { category_slug: string; user_id: string; rating: number }[]) {
    ((byCat[r.category_slug] ??= {})[r.user_id] ??= []).push(r.rating);
  }
  const reliability = Object.entries(byCat).map(([slug, perUser]) => {
    const series = Object.values(perUser);
    return { slug, ...testRetestReliability(series) };
  }).filter((r) => r.icc != null);

  // Instrumentation coverage: the new measurement layers, visible to the operator - are the
  // capture paths actually filling, and is anyone using the opt-in features?
  const instr = (await pg`
    SELECT
      (SELECT count(*)::int FROM user_category_baseline) AS baselines,
      (SELECT count(DISTINCT user_id)::int FROM user_category_baseline) AS baseline_users,
      (SELECT count(*)::int FROM reaction_runs) AS reaction_runs,
      (SELECT count(*)::int FROM attempts WHERE status = 'answered' AND served_at > now() - interval '7 days') AS ans7,
      (SELECT count(*)::int FROM attempts WHERE status = 'answered' AND served_at > now() - interval '7 days' AND first_input_ms IS NOT NULL) AS micro7,
      (SELECT count(*)::int FROM attempts WHERE word_times IS NOT NULL) AS word_timed,
      (SELECT count(*)::int FROM user_settings WHERE reminder_enabled) AS reminders_on,
      (SELECT count(*)::int FROM user_settings WHERE conditional_enabled) AS conditionals_on,
      (SELECT count(*)::int FROM user_settings WHERE array_length(preferred_decks, 1) > 0) AS decks_set
  `)[0];

  return { vitals, site, derived, quality, referrers, visits, categories, distribution, verbalByLang, verbalComparison, reliability, correlations, consentBias, validity, practice, minCell, instr };
};
