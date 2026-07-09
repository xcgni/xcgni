import { pg } from '$lib/server/db';
import { gateTimeOfDay, gateLearningCurve, gatePosition, type Finding } from './findings-core';

/**
 * Personal findings (v1.5.0): the instrument starts SPEAKING, not just displaying.
 * Each finding is GATED - it renders only when its own statistical bar is met, and below
 * the bar it says exactly what is missing ("14 more evening attempts unlock this").
 * Honesty rules: effect sizes with n, no causal language, practice effects named as such.
 * The heavy lifting (gates, effect math) lives in ./findings-core, pure and unit-tested;
 * this module only runs the SQL and hands rows over.
 */

export type { Finding } from './findings-core';

export async function personalFindings(userId: string): Promise<Finding[]> {
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
  out.push(gateTimeOfDay(bands as { band: string; n: number; mean: number; sd: number }[]));

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
  out.push(gateLearningCurve(curves as { category_slug: string; n: number; early_mean: number; late_mean: number }[]));

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
  out.push(gatePosition(pos as { bucket: string; n: number; mean: number; sd: number }[]));

  return out;
}
