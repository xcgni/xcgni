import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';

/**
 * The notification PLAN: everything the app shell needs to schedule local notifications that
 * match reality as of this moment. The shell calls this on app open and mirrors it 1:1 into the
 * OS scheduler (see syncNotificationSchedule in native.ts).
 *
 * Philosophy enforced HERE, server-side, so no client can nag: everything is opt-in, at most one
 * daily reminder and at most one conditional per day is ever emitted, conditionals carry facts
 * ("6 cards due"), never guilt. Quiet by default.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ reminder: { enabled: false, time: '18:00' }, conditionals: [] });

  const settingsRows = await pg`
    SELECT reminder_enabled, reminder_time, conditional_enabled
    FROM user_settings WHERE user_id = ${user.id}
  `;
  const s = settingsRows[0] ?? { reminder_enabled: false, reminder_time: '18:00', conditional_enabled: false };

  const conditionals: { id: number; at: string; title: string; body: string }[] = [];
  // The timezone below is CLIENT-SUPPLIED (stored from the browser). An invalid IANA name makes
  // Postgres throw, which would 500 the whole plan - so the conditional block is defensive:
  // any failure inside it degrades to "no conditionals", never to a broken endpoint.
  try {
  if (s.conditional_enabled) {
    // The user's local timezone, best known from their most recent session (IANA name).
    const tzRows = await pg`
      SELECT timezone FROM practice_sessions
      WHERE user_id = ${user.id} AND timezone IS NOT NULL
      ORDER BY last_activity_at DESC LIMIT 1
    `;
    const tz = tzRows[0]?.timezone ?? 'UTC';

    // Retention cards that will be due by tomorrow mid-morning (09:30 local): a fact worth a nudge.
    const due = await pg`
      SELECT count(*)::int AS n
      FROM user_card_state ucs
      JOIN retention_cards c ON c.id = ucs.card_id
      WHERE ucs.user_id = ${user.id} AND c.active
        AND ucs.due_at <= ((now() AT TIME ZONE ${tz})::date + interval '1 day' + interval '9 hours 30 minutes') AT TIME ZONE ${tz}
    `;
    const dueTomorrow = due[0]?.n ?? 0;
    if (dueTomorrow > 0) {
      // fire tomorrow 09:30 in the user's timezone, expressed as a UTC instant for the scheduler
      const at = await pg`
        SELECT (((now() AT TIME ZONE ${tz})::date + interval '1 day' + interval '9 hours 30 minutes') AT TIME ZONE ${tz}) AS at
      `;
      conditionals.push({
        id: 100,
        at: new Date(at[0].at).toISOString(),
        title: 'Excogni',
        body: dueTomorrow === 1 ? '1 retention card is due.' : `${dueTomorrow} retention cards are due.`
      });
    }
  }

  } catch { /* invalid timezone or transient DB issue: serve the reminder, skip conditionals */ }

  return json({
    reminder: { enabled: !!s.reminder_enabled, time: s.reminder_time ?? '18:00' },
    // cap: at most ONE conditional in the plan (the philosophy is a quiet instrument, not a feed)
    conditionals: conditionals.slice(0, 1)
  });
};
