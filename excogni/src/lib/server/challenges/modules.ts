import { pg } from '$lib/server/db';
import { log } from '$lib/server/log';

/**
 * Decides whether a step of the mixed run should hand off to a dedicated module
 * (Retention or Reaction Time) instead of serving a normal bank challenge.
 *
 * These two are NOT bank-backed and have their own interaction models, but they are real
 * cognitive domains that must be part of a genuinely "mixed" profile. Rather than force the
 * user to visit separate screens (which meant these radar spokes sat empty and skewed the
 * profile + percentile), the mixed run now offers them in rotation, each respecting its own
 * measurement-honesty rule:
 *
 *  - Retention counts as measurement only when a card is genuinely DUE (SM-2). So we offer a
 *    retention hand-off when the user has due cards, OR has never been measured on retention at
 *    all (so a first, honest calibration burst can happen). If nothing is due and it's already
 *    calibrated, we don't nag.
 *  - Reaction needs calibration + a run of trials. We offer it when the user has never done it
 *    (uncalibrated -> first burst), or occasionally when the last measurement is stale. A single
 *    trial is meaningless, so this always sends the user into the dedicated trial run.
 *
 * Respect for the enabled set: a module is only offered if its slug is enabled (not unticked).
 * Cadence guards keep modules from dominating: at most one hand-off is suggested per call, and
 * both are gated so they appear intermittently, not every step.
 */

export type ModuleHandoff = { module: 'retention' | 'reaction'; reason: 'due-cards' | 'learning' | 'uncalibrated' | 'stale' } | null;

const RETENTION_SLUG = 'retention';
const REACTION_SLUG = 'reaction_time';

// Retention calibrates at this many DUE reviews (its attempts_count only counts genuinely-due
// recalls). The global 10-attempt bar would gate "profile complete" on WEEKS of SM-2 intervals;
// 3 real due recalls is an honest first read for a construct that matures over days by nature.
export const RETENTION_CALIBRATE = 3;

// Minimum seconds between module hand-offs, so the mix doesn't bounce into a module repeatedly
// (especially right after one returns). A retention burst is ~5 cards; a reaction run ~5 trials;
// 90s comfortably spaces them past a single burst's duration.
const MODULE_MIN_GAP_SECONDS = 90;

export async function pickModuleHandoff(
  userId: string,
  sessionId: string,
  enabledSlugs: string[]
): Promise<ModuleHandoff> {
  const retentionEnabled = enabledSlugs.length === 0 || enabledSlugs.includes(RETENTION_SLUG);
  const reactionEnabled = enabledSlugs.length === 0 || enabledSlugs.includes(REACTION_SLUG);
  if (!retentionEnabled && !reactionEnabled) return null;

  // Spacing guard: don't hand off to a module if we did so recently. Modules (retention/reaction)
  // do NOT write to the attempts table, so we track the last hand-off time on the session instead.
  // This prevents an immediate re-handoff loop when the module returns to the run.
  const sess = await pg`
    SELECT last_module_at,
           extract(epoch from (now() - coalesce(last_module_at, 'epoch'::timestamptz))) AS since_s
    FROM practice_sessions WHERE id = ${sessionId}
  `;
  const sinceModuleS = sess[0]?.since_s ?? Number.MAX_SAFE_INTEGER;
  if (sinceModuleS < MODULE_MIN_GAP_SECONDS) return null;

  // PER-SESSION CAP: each module at most ONCE per session. The 90s gap alone let a long session
  // re-offer retention while still uncalibrated (learning cards remained), which felt like nagging.
  const used = await pg`SELECT modules_used FROM practice_sessions WHERE id = ${sessionId}`;
  const usedSet = new Set<string>((used[0]?.modules_used as string[] | null) ?? []);

  // Require at least a couple of normal challenges to have happened first, so a session
  // doesn't open on a module.
  const totalThisSession = await pg`
    SELECT count(*)::int AS n FROM attempts WHERE session_id = ${sessionId}
  `;
  if ((totalThisSession[0]?.n ?? 0) < 2) return null;

  // --- Retention availability ---
  if (retentionEnabled && !usedSet.has('retention')) {
    const avail = await pg`
      SELECT
        (SELECT count(*)::int FROM user_card_state s
           JOIN retention_cards c ON c.id = s.card_id
          WHERE s.user_id = ${userId} AND c.active AND s.due_at <= now()) AS due,
        (SELECT count(*)::int FROM retention_cards c
          WHERE c.active AND c.id NOT IN
            (SELECT card_id FROM user_card_state WHERE user_id = ${userId})) AS unseen
    `;
    const dueCount = avail[0]?.due ?? 0;
    const unseenCount = avail[0]?.unseen ?? 0;
    const everMeasured = await pg`
      SELECT attempts_count FROM user_category_state
      WHERE user_id = ${userId} AND category_slug = ${RETENTION_SLUG}
    `;
    const retentionAttempts = everMeasured[0]?.attempts_count ?? 0;
    // Offer retention ONLY when the screen has something real to serve: due cards (the actual
    // measurement) or unseen cards to learn. Never hand off into an "All caught up" empty screen -
    // that was possible when the uncalibrated check ignored availability.
    // Retention calibrates at RETENTION_CALIBRATE due reviews (not the global 10): the construct
    // matures over days by SM-2's nature, so the bar matches the construct instead of silently
    // gating "profile complete" for weeks.
    if (dueCount > 0) {
      log.info('module-handoff', { module: 'retention', reason: 'due-cards', dueCount });
      return { module: 'retention', reason: 'due-cards' };
    }
    if (retentionAttempts < RETENTION_CALIBRATE && unseenCount > 0) {
      log.info('module-handoff', { module: 'retention', reason: 'learning', unseenCount });
      return { module: 'retention', reason: 'learning' };
    }
  }

  // --- Reaction availability ---
  if (reactionEnabled && !usedSet.has('reaction')) {
    const rt = await pg`
      SELECT attempts_count,
             extract(epoch from (now() - coalesce(updated_at, 'epoch'::timestamptz))) AS age_s
      FROM user_category_state
      WHERE user_id = ${userId} AND category_slug = ${REACTION_SLUG}
    `;
    const reactionAttempts = rt[0]?.attempts_count ?? 0;
    // Staleness is measured from updated_at (last actual reaction run), NOT peak_rating_at: a
    // daily-active user whose PEAK is old must not be nagged into re-measuring.
    const ageS = rt[0]?.age_s ?? Number.MAX_SAFE_INTEGER;
    if (reactionAttempts < 10) {
      log.info('module-handoff', { module: 'reaction', reason: 'uncalibrated', reactionAttempts });
      return { module: 'reaction', reason: 'uncalibrated' };
    }
    if (ageS > 7 * 24 * 3600) {
      log.info('module-handoff', { module: 'reaction', reason: 'stale', ageDays: Math.round(ageS / 86400) });
      return { module: 'reaction', reason: 'stale' };
    }
  }

  return null;
}
