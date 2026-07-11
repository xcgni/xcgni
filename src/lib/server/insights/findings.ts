import { pg } from '$lib/server/db';
import { gateTimeOfDay, gateLearningCurve, gatePosition, gateSleep, gateCaffeine, gateTagDays, type Finding } from './findings-core';
import { translate, type Locale } from '$lib/i18n';

/**
 * Personal findings (v1.5.0): the instrument starts SPEAKING, not just displaying.
 * Each finding is GATED - it renders only when its own statistical bar is met, and below
 * the bar it says exactly what is missing ("14 more evening attempts unlock this").
 * Honesty rules: effect sizes with n, no causal language, practice effects named as such.
 * The heavy lifting (gates, effect math) lives in ./findings-core, pure and unit-tested;
 * this module only runs the SQL and hands rows over.
 */

export type { Finding } from './findings-core';

export async function personalFindings(userId: string, locale: Locale = 'en'): Promise<Finding[]> {
  const catName = (slug: string) => {
    const v = translate(locale, ('cat.' + slug) as Parameters<typeof translate>[1]);
    return v && !v.startsWith('cat.') ? v : slug.replace(/_/g, ' ');
  };
  const out: Finding[] = [];

  // F1 - time of day: mean score by local-hour band, answered attempts only
  const bands = await pg`
    SELECT CASE
             WHEN local_hour BETWEEN 5 AND 11 THEN 'morning'
             WHEN local_hour BETWEEN 12 AND 17 THEN 'afternoon'
             ELSE 'evening'
           END AS band,
           count(*)::int AS n,
           avg(score)::float AS mean,
           coalesce(stddev_samp(score), 0)::float AS sd
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND score IS NOT NULL AND local_hour IS NOT NULL
    GROUP BY 1
  `;
  out.push(gateTimeOfDay(bands as { band: string; n: number; mean: number; sd: number }[], locale));

  // F2 - learning curve per category: early vs late attempt scores (practice effect, named)
  const curves = await pg`
    WITH ordered AS (
      SELECT category_slug, score,
             row_number() OVER (PARTITION BY category_slug ORDER BY submitted_at) AS ord,
             count(*)   OVER (PARTITION BY category_slug) AS total
      FROM attempts
      WHERE user_id = ${userId} AND status = 'answered' AND score IS NOT NULL
    )
    SELECT category_slug,
           max(total)::int AS n,
           avg(score) FILTER (WHERE ord <= total / 3)::float AS early_mean,
           avg(score) FILTER (WHERE ord > total - total / 3)::float AS late_mean
    FROM ordered
    WHERE total >= 12
    GROUP BY category_slug
  `;
  out.push(gateLearningCurve(curves as { category_slug: string; n: number; early_mean: number; late_mean: number }[], locale, catName));

  // F3 - within-session position: does performance drift as a session progresses
  const pos = await pg`
    SELECT CASE
             WHEN session_position <= 3 THEN 'start'
             WHEN session_position <= 6 THEN 'middle'
             ELSE 'late'
           END AS bucket,
           count(*)::int AS n,
           avg(score)::float AS mean,
           coalesce(stddev_samp(score), 0)::float AS sd
    FROM attempts
    WHERE user_id = ${userId} AND status = 'answered' AND score IS NOT NULL AND session_position IS NOT NULL
    GROUP BY 1
  `;
  out.push(gatePosition(pos as { bucket: string; n: number; mean: number; sd: number }[], locale));

  // F4 - sleep (J5): same-day pairing of pre-session sleep hours with attempt scores.
  // Short vs rested at a 6.5h line; the context row is the day's first (sleep is asked
  // once per local day). Day-level association only - the gate's wording says so.
  const sleep = await pg`
    WITH day_sleep AS (
      SELECT user_id, local_date, max(sleep_hours) AS sleep_hours
      FROM session_context
      WHERE user_id = ${userId} AND sleep_hours IS NOT NULL AND local_date IS NOT NULL
      GROUP BY user_id, local_date
    )
    SELECT CASE WHEN ds.sleep_hours < 6.5 THEN 'short-sleep (<6.5h)' ELSE 'rested (6.5h+)' END AS band,
           count(*)::int AS n,
           avg(a.score)::float AS mean,
           coalesce(stddev_samp(a.score), 0)::float AS sd
    FROM attempts a
    JOIN day_sleep ds
      ON ds.user_id = a.user_id
     AND ds.local_date = make_date(a.local_year, a.local_month, a.local_day)
    WHERE a.user_id = ${userId} AND a.status = 'answered' AND a.score IS NOT NULL
      AND a.local_year IS NOT NULL
    GROUP BY 1
  `;
  out.push(gateSleep(sleep as { band: string; n: number; mean: number; sd: number }[], locale));

  // F5 - caffeine (J5): the day's strongest reported level paired with that day's scores.
  const caffeine = await pg`
    WITH day_caf AS (
      SELECT user_id, local_date,
             max(CASE caffeine WHEN 'lots' THEN 2 WHEN 'some' THEN 1 ELSE 0 END) AS lvl
      FROM session_context
      WHERE user_id = ${userId} AND caffeine IS NOT NULL AND local_date IS NOT NULL
      GROUP BY user_id, local_date
    )
    SELECT CASE dc.lvl WHEN 2 THEN 'high-caffeine' WHEN 1 THEN 'some-caffeine' ELSE 'no-caffeine' END AS band,
           count(*)::int AS n,
           avg(a.score)::float AS mean,
           coalesce(stddev_samp(a.score), 0)::float AS sd
    FROM attempts a
    JOIN day_caf dc
      ON dc.user_id = a.user_id
     AND dc.local_date = make_date(a.local_year, a.local_month, a.local_day)
    WHERE a.user_id = ${userId} AND a.status = 'answered' AND a.score IS NOT NULL
      AND a.local_year IS NOT NULL
    GROUP BY 1
  `;
  out.push(gateCaffeine(caffeine as { band: string; n: number; mean: number; sd: number }[], locale));

  // F6/F7 - tag findings (day-fold: any tagged session marks the day). The tag system is
  // private self-tracking; these findings are its payoff. Music first (population evidence
  // is genuinely heterogeneous - personal data beats general advice here), then the
  // after-work hypothesis.
  const tagBands = async (slug: string, onLabel: string, offLabel: string) => {
    const rows = await pg`
      WITH day_tag AS (
        SELECT user_id, local_date, bool_or(${slug} = ANY(coalesce(tags, '{}'))) AS tagged
        FROM session_context
        WHERE user_id = ${userId} AND local_date IS NOT NULL
        GROUP BY user_id, local_date
      )
      SELECT CASE WHEN dt.tagged THEN ${onLabel} ELSE ${offLabel} END AS band,
             count(*)::int AS n,
             avg(a.score)::float AS mean,
             coalesce(stddev_samp(a.score), 0)::float AS sd
      FROM attempts a
      JOIN day_tag dt
        ON dt.user_id = a.user_id
       AND dt.local_date = make_date(a.local_year, a.local_month, a.local_day)
      WHERE a.user_id = ${userId} AND a.status = 'answered' AND a.score IS NOT NULL
        AND a.local_year IS NOT NULL
      GROUP BY 1
    `;
    return rows as { band: string; n: number; mean: number; sd: number }[];
  };
  out.push(gateTagDays('tag_music', translate(locale, 'find.music.title'), translate(locale, 'find.music.title'),
    await tagBands('music', 'music', 'no-music'), locale));
  out.push(gateTagDays('tag_after_work', translate(locale, 'find.afterwork.title'), translate(locale, 'find.afterwork.title'),
    await tagBands('after-work', 'after-work', 'other'), locale));

  return out;
}
