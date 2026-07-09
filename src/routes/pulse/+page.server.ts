import type { PageServerLoad } from './$types';
import { pg } from '$lib/server/db';
import { cognitiveWeather } from '$lib/server/insights/forecast';

// Daily pulse landing (v1.5.0): the 90-second ritual's front door. Shows the days-practiced
// count (a count, never a streak - there is no chain to break) and whether today already
// has a pulse. Anonymous visitors can pulse too; the count then reflects this device's user.
export const load: PageServerLoad = async ({ locals }) => {
  let daysPracticed = 0;
  let todayDone = false;
  let weather = null;
  if (locals.user) {
    weather = await cognitiveWeather(locals.user.id);
    const dp = await pg`
      SELECT count(DISTINCT (local_year, local_month, local_day))::int AS n
      FROM attempts
      WHERE user_id = ${locals.user.id} AND status = 'answered' AND local_year IS NOT NULL
    `;
    daysPracticed = dp[0]?.n ?? 0;
    const today = await pg`
      SELECT 1 FROM practice_sessions s
      JOIN attempts a ON a.session_id = s.id AND a.status = 'answered'
      WHERE s.user_id = ${locals.user.id} AND s.kind = 'pulse'
        AND s.started_at > now() - interval '20 hours'
      LIMIT 1
    `;
    todayDone = today.length > 0;
  }
  return { daysPracticed, todayDone, weather };
};
