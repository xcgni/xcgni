import { pg } from '$lib/server/db';

/**
 * Opportunistic housekeeping (v0.67.1): runs at most once per day per process, fired
 * from the request path without blocking it. No cron, no scheduler - the same posture
 * as the rate-limit prune.
 *
 * What it removes, and why it is safe:
 *  - ANONYMOUS users older than 30 days who never left a trace: no attempts, no
 *    reaction runs, no retention state, no day notes, no session context, no feedback.
 *    These are drive-by rows from ensureUser - people who clicked once and left. Their
 *    cookie has a 90-day session, but a session pointing at data-less row serves
 *    nothing; if they return, ensureUser mints a fresh row exactly as before.
 *    Registered users are NEVER touched, no matter how empty.
 *  - Expired auth sessions and expired/consumed magic links past a grace window -
 *    dead rows that only lengthen index scans.
 *
 * Holding nothing about people who left is the privacy posture, applied to the
 * database itself.
 */
let lastRun = 0;
const EVERY_MS = 24 * 60 * 60 * 1000;

export function maybeRunGc(): void {
  const now = Date.now();
  if (now - lastRun < EVERY_MS) return;
  lastRun = now; // claim the slot first so concurrent requests don't double-fire
  void runGc().catch((e) => console.error('[gc] failed:', e));
}

export async function runGc(): Promise<{ anonUsers: number; sessions: number; links: number }> {
  const anon = await pg`
    DELETE FROM users u
    WHERE u.is_anonymous
      AND u.created_at < now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM reaction_runs r WHERE r.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM user_card_state c WHERE c.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM day_note d WHERE d.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM session_context s WHERE s.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = u.id)
  `;
  const sessions = await pg`
    DELETE FROM auth_sessions WHERE expires_at < now() - interval '7 days'
  `;
  const links = await pg`
    DELETE FROM magic_links WHERE expires_at < now() - interval '7 days'
  `;
  return { anonUsers: anon.count, sessions: sessions.count, links: links.count };
}

/** Test hook. */
export function _resetGcClock(): void {
  lastRun = 0;
}
