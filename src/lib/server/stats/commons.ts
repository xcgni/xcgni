// Commons findings (v1.6.0) - what the pool gives back. Population-level patterns from
// CONSENTED users only, published openly, each gated by the public anonymity floor per
// compared group and an effect bar. Same house rules as every public stat: withheld is
// shown as withheld, null results are published, no dates - findings anchor to pool size.
// Preview mode (never on in prod by default) includes simulated users, labeled upstream.

import { pg } from '$lib/server/db';
import { adminConfig } from '$lib/server/flags';
import { cached } from '$lib/server/cache';
import {
  gatePopulationBands, gatePopulationLearning,
  type CommonsFinding, type PopBand
} from '$lib/server/insights/commons-core';

export type { CommonsFinding } from '$lib/server/insights/commons-core';

const TTL = 60_000;

function consentPredicate(preview: boolean) {
  return preview
    ? pg`ua.consented_stats = true AND u.is_anonymous = false AND u.is_test = false`
    : pg`ua.consented_stats = true AND u.is_anonymous = false AND u.is_test = false AND u.is_simulated = false`;
}

async function computeCommonsFindings(preview: boolean): Promise<{ findings: CommonsFinding[]; poolUsers: number }> {
  const floor = adminConfig.publicMinCell();

  const pool = await pg`
    SELECT count(*)::int AS n
    FROM users u JOIN user_attributes ua ON ua.user_id = u.id
    WHERE ${consentPredicate(preview)}
  `;
  const poolUsers = pool[0]?.n ?? 0;

  // C1 - time of day across the pool
  const todRows = await pg`
    SELECT CASE
             WHEN a.local_hour BETWEEN 5 AND 11 THEN 'morning'
             WHEN a.local_hour BETWEEN 12 AND 17 THEN 'afternoon'
             ELSE 'evening'
           END AS band,
           count(DISTINCT a.user_id)::int AS n_users,
           count(*)::int AS n_attempts,
           avg(a.score)::float AS mean,
           coalesce(stddev_samp(a.score), 0)::float AS sd
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN user_attributes ua ON ua.user_id = u.id
    WHERE ${consentPredicate(preview)}
      AND a.status = 'answered' AND a.score IS NOT NULL AND a.local_hour IS NOT NULL
    GROUP BY 1
  `;
  const todBands: PopBand[] = todRows.map((r: Record<string, unknown>) => ({
    band: r.band as string, nUsers: r.n_users as number, nAttempts: r.n_attempts as number,
    mean: r.mean as number, sd: r.sd as number
  }));

  // C2 - session position across the pool
  const posRows = await pg`
    SELECT CASE
             WHEN a.session_position <= 3 THEN 'session start'
             WHEN a.session_position <= 6 THEN 'mid-session'
             ELSE 'late session'
           END AS band,
           count(DISTINCT a.user_id)::int AS n_users,
           count(*)::int AS n_attempts,
           avg(a.score)::float AS mean,
           coalesce(stddev_samp(a.score), 0)::float AS sd
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN user_attributes ua ON ua.user_id = u.id
    WHERE ${consentPredicate(preview)}
      AND a.status = 'answered' AND a.score IS NOT NULL AND a.session_position IS NOT NULL
    GROUP BY 1
  `;
  const posBands: PopBand[] = posRows.map((r: Record<string, unknown>) => ({
    band: r.band as string, nUsers: r.n_users as number, nAttempts: r.n_attempts as number,
    mean: r.mean as number, sd: r.sd as number
  }));

  // C3 - practice effect: per-user early-vs-late relative gain, pool median + IQR
  const gainRows = await pg`
    WITH ordered AS (
      SELECT a.user_id, a.score,
             row_number() OVER (PARTITION BY a.user_id ORDER BY a.submitted_at) AS ord,
             count(*)    OVER (PARTITION BY a.user_id) AS total
      FROM attempts a
      JOIN users u ON u.id = a.user_id
      JOIN user_attributes ua ON ua.user_id = u.id
      WHERE ${consentPredicate(preview)}
        AND a.status = 'answered' AND a.score IS NOT NULL
    ),
    per_user AS (
      SELECT user_id,
             avg(score) FILTER (WHERE ord <= total / 3) AS early,
             avg(score) FILTER (WHERE ord > total - total / 3) AS late
      FROM ordered WHERE total >= 20
      GROUP BY user_id
    ),
    gains AS (
      SELECT CASE WHEN early <> 0 THEN (late - early) / abs(early) ELSE NULL END AS gain
      FROM per_user WHERE early IS NOT NULL AND late IS NOT NULL
    )
    SELECT count(*)::int AS n_users,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY gain)::float AS median_gain,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY gain)::float AS q1,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY gain)::float AS q3
    FROM gains WHERE gain IS NOT NULL
  `;
  const g = gainRows[0] ?? { n_users: 0, median_gain: null, q1: null, q3: null };

  const findings: CommonsFinding[] = [
    gatePopulationBands('pool_time_of_day', 'Time of day, pool-wide', 'time-of-day', todBands, floor),
    gatePopulationBands('pool_session_position', 'Within a session, pool-wide', 'session-position', posBands, floor),
    gatePopulationLearning(
      { nUsers: g.n_users as number, medianGain: g.median_gain as number | null, q1: g.q1 as number | null, q3: g.q3 as number | null },
      floor
    )
  ];
  return { findings, poolUsers };
}

export async function commonsFindings(preview: boolean) {
  return cached(`commons-findings:${preview}`, TTL, () => computeCommonsFindings(preview));
}
