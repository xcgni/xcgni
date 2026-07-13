import { pg } from '$lib/server/db';
import { forecastFromBands, type Forecast } from './findings-core';

export type { Forecast } from './findings-core';

/**
 * Cognitive weather (v1.9.0): the user's historical time-of-day pattern, spoken at the
 * moment it is relevant. The user's local hour comes from their latest session's stored
 * tz offset (the client supplies it on every run) - no IP geolocation, nothing new
 * collected. Silence when the pattern would not clear the finding gates, or when the
 * offset is unknown.
 */
export async function cognitiveWeather(userId: string, locale: import('$lib/i18n').Locale = 'en'): Promise<Forecast | null> {
  const tz = await pg`
    SELECT tz_offset_min FROM practice_sessions
    WHERE user_id = ${userId} AND tz_offset_min IS NOT NULL
    ORDER BY started_at DESC LIMIT 1
  `;
  const offsetMin = tz[0]?.tz_offset_min;
  if (typeof offsetMin !== 'number') return null;
  // JS getTimezoneOffset convention: minutes to ADD to local to get UTC, so local = UTC - offset
  const nowHour = new Date(Date.now() - offsetMin * 60_000).getUTCHours();

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
  return forecastFromBands(
    bands as { band: string; n: number; mean: number; sd: number }[],
    nowHour,
    locale
  );
}
