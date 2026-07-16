import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { flags } from '$lib/server/flags';
import { hasSeenIntro, markIntroSeen, getEnabledCategories, INACTIVITY_MINUTES } from '$lib/server/sessions';
import { contextPlan } from '$lib/server/sessions/context';
import { pg } from '$lib/server/db';
import { log } from '$lib/server/log';

export const load: PageServerLoad = async ({ locals, url }) => {
  // Daily pulse mode (v1.5.0): a 90-second ritual - three adaptive items, no pre-session
  // questionnaire, its own session kind. The run machinery is identical; only length and
  // gates differ. Days-practiced count feeds the finish screen (a count, never a streak).
  const isPulse = url.searchParams.get('pulse') === '1';
  // Bankless categories have dedicated screens - never run them in the timed loop.
  const cat = url.searchParams.get('category');
  if (cat === 'retention') throw redirect(303, '/practice/retention');
  if (cat === 'reaction_time') throw redirect(303, '/practice/reaction');

  // First-run gate: registered/anonymous users who haven't seen the contract
  // go through /welcome first. ?skipintro=1 (set after onboarding) bypasses.
  if (locals.user && url.searchParams.get('skipintro') !== '1') {
    const seen = await hasSeenIntro(locals.user.id);
    if (!seen) {
      // Self-heal: anyone with a recorded attempt has factually passed onboarding -
      // a missing flag (legacy row, module return, edge path) must never bounce a
      // practicing user back to the contract mid-session.
      const [prior] = await pg`SELECT 1 FROM attempts WHERE user_id = ${locals.user.id} LIMIT 1`;
      if (prior) {
        log.info('intro-gate-selfheal', { userId: locals.user.id });
        await markIntroSeen(locals.user.id);
      } else {
        log.info('intro-gate-redirect', { userId: locals.user.id, url: url.pathname + url.search });
        // True first-timer: preserve intent - land back on exactly what was clicked.
        throw redirect(303, '/welcome?next=' + encodeURIComponent(url.pathname + url.search));
      }
    }
  }
  let sessionLength = isPulse ? 3 : 10;
  let askDaily = false;
  let askNap = false;
  let sessionInProgress = false;
  let sessionAnswered = 0;
  if (locals.user) {
    if (!isPulse) {
      const rows = await pg`SELECT session_length FROM user_settings WHERE user_id = ${locals.user.id}`;
      sessionLength = rows[0]?.session_length ?? 10;
    }
    const utcDate = new Date().toISOString().slice(0, 10);
    if (!isPulse) {
      const plan = await contextPlan(locals.user.id, utcDate);
      askDaily = plan.askDaily;
      askNap = plan.askNap;
    }
    // If the user's current open session already has attempts, they're mid-session (e.g. returning
    // from a Retention/Reaction hand-off). The pre-session questionnaire is a per-SESSION gate and
    // must not re-ask on every remount of this page - one session, one ask.
    const open = await pg`
      SELECT s.id FROM practice_sessions s
      WHERE s.user_id = ${locals.user.id} AND s.ended_at IS NULL
        AND s.last_activity_at > now() - (${INACTIVITY_MINUTES} * interval '1 minute')
      ORDER BY s.last_activity_at DESC LIMIT 1
    `;
    if (open[0]) {
      const att = await pg`
        SELECT count(*) FILTER (WHERE status <> 'pending')::int AS answered, count(*)::int AS total
        FROM attempts WHERE session_id = ${open[0].id}
      `;
      sessionInProgress = (att[0]?.total ?? 0) > 0;
      // Resume the session's progress counter, and count a module hand-off (Retention/Reaction
      // burst) as ONE step of the bounded session - it's one "challenge" of the mix, so the
      // progress the user sees continues instead of restarting at 1.
      const mod = await pg`SELECT module_handoffs FROM practice_sessions WHERE id = ${open[0].id}`;
      sessionAnswered = (att[0]?.answered ?? 0) + (mod[0]?.module_handoffs ?? 0);
    }
  }
  let daysPracticed = 0;
  if (isPulse && locals.user) {
    const dp = await pg`
      SELECT count(DISTINCT (local_year, local_month, local_day))::int AS n
      FROM attempts
      WHERE user_id = ${locals.user.id} AND status = 'answered' AND local_year IS NOT NULL
    `;
    daysPracticed = dp[0]?.n ?? 0;
  }
  return { showDebug: flags.showDebugUi(), sessionLength, askDaily, askNap, sessionInProgress, sessionAnswered, isPulse, daysPracticed };
};
