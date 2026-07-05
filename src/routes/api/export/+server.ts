import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';
import { METHODOLOGY_VERSION } from '$lib/methodology';

/**
 * GET /api/export - downloads everything Excogni holds about the current user
 * as a single JSON file. Makes the "your data is yours" promise concrete and
 * verifiable, not just stated. Anonymous users can export too.
 */
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'not signed in' }), {
      status: 401, headers: { 'content-type': 'application/json' }
    });
  }
  const uid = locals.user.id;

  const [account, settings, attributes, categoryState, sessions, attempts, ratingHistory, context, cardState, rtCalibration, baselines, reactionRuns, dayNotes, myFeedback, spelling, circleMemberships, circlesCreated] = await Promise.all([
    pg`SELECT id, email, email_hint, username, is_anonymous, is_test, created_at FROM users WHERE id = ${uid}`,
    pg`SELECT enabled_categories, disabled_categories, reduced_categories, session_length, seen_intro,
              reminder_enabled, reminder_time, conditional_enabled, preferred_decks, public_badge, updated_at
       FROM user_settings WHERE user_id = ${uid}`,
    pg`SELECT birth_year, age_band, country, city, gender, education, native_language, handedness, ext_test_type, ext_test_score, consented_stats, consented_data, consent_at, consent_version, updated_at
       FROM user_attributes WHERE user_id = ${uid}`,
    pg`SELECT category_slug, current_level, stable_level, rating, attempts_count, correct_count,
              peak_rating, peak_rating_at, max_level, max_level_at, updated_at
       FROM user_category_state WHERE user_id = ${uid} ORDER BY category_slug`,
    pg`SELECT id, started_at, last_activity_at, ended_at, timezone, tz_offset_min,
              skipped_categories, modules_used, module_handoffs
       FROM practice_sessions WHERE user_id = ${uid} ORDER BY started_at`,
    pg`SELECT a.id, a.session_id, a.category_slug, a.level, a.status, a.served_at, a.submitted_at,
              a.client_elapsed_ms, a.server_elapsed_ms, a.effective_ms, a.answer, a.correct, a.score,
              a.speed_class, a.est_error, a.rating_before, a.rating_after,
              a.rt_fast_ms, a.rt_slow_ms,
              a.local_hour, a.local_dow, a.local_month, a.local_day, a.local_week, a.local_year,
              a.session_position, a.quality_flags, a.input_method,
              a.first_input_ms, a.edits_count, a.first_answer_changed, a.word_times,
              a.challenge_version, a.scoring_model_version, a.methodology_version,
              c.prompt_data
       FROM attempts a JOIN challenges c ON c.id = a.challenge_id
       WHERE a.user_id = ${uid} ORDER BY a.served_at`,
    pg`SELECT category_slug, rating, recorded_at FROM rating_history WHERE user_id = ${uid} ORDER BY recorded_at`,
    pg`SELECT local_date, sleep_hours, napped, rested, hours_awake, caffeine, other_stimulant, alertness, mood, device_kind
       FROM session_context WHERE user_id = ${uid} ORDER BY local_date`,
    pg`SELECT s.card_id, c.deck, c.prompt, s.ease, s.interval_days, s.reps, s.lapses, s.due_reviews, s.due_hits, s.due_at, s.last_seen_at
       FROM user_card_state s JOIN retention_cards c ON c.id = s.card_id WHERE s.user_id = ${uid} ORDER BY c.deck, c.prompt`,
    pg`SELECT floor_ms, uncertainty_ms, refresh_hz, updated_at FROM user_rt_calibration WHERE user_id = ${uid}`,
    pg`SELECT category_slug, rating, attempts_count, captured_at FROM user_category_baseline WHERE user_id = ${uid} ORDER BY category_slug`,
    pg`SELECT measured_ms, floor_ms, band_fast_ms, band_slow_ms, created_at FROM reaction_runs WHERE user_id = ${uid} ORDER BY created_at`,
    pg`SELECT local_date, note, created_at FROM day_note WHERE user_id = ${uid} ORDER BY local_date`,
    pg`SELECT created_at, route, kind, message, resolved FROM feedback WHERE user_id = ${uid} ORDER BY created_at`,
    // Spelling-accuracy trait counters (migration 0020) - user data like any other.
    pg`SELECT typed_words, typo_words, updated_at FROM user_spelling WHERE user_id = ${uid}`,
    // Circle memberships: the display name and sharing choices the user set are their data.
    // The circle's name and join code are included because the user already holds the code
    // (they joined with it); other members' data is never included.
    pg`SELECT c.name AS circle_name, c.code AS circle_code, m.display_name,
              m.share_activity, m.share_ratings, m.joined_at
       FROM circle_members m JOIN circles c ON c.id = m.circle_id
       WHERE m.user_id = ${uid} ORDER BY m.joined_at`,
    pg`SELECT name, code, created_at FROM circles WHERE created_by = ${uid} ORDER BY created_at`
  ]);

  const payload = {
    export_meta: {
      product: 'Excogni',
      generated_at: new Date().toISOString(),
      methodology_version: METHODOLOGY_VERSION,
      methodology_note: 'Each attempt and rating snapshot is stamped with the methodology version it was computed under. See /methodology for what each version pins.',
      schema_note: 'All timestamps are UTC. local_hour/local_dow are derived from the session timezone at submit time.',
      account_type: locals.user.isAnonymous ? 'anonymous' : 'registered',
      deliberately_excluded: 'auth session tokens and magic-link tokens (credentials, not data about you)'
    },
    // In blind-index mode (EMAIL_INDEX_KEY set) `email` is null by design: the readable
    // address is never stored, only a keyed one-way index for login plus the masked
    // `email_hint`. This export contains everything Excogni holds - a readable address
    // is genuinely not part of it.
    account: account[0] ?? null,
    settings: settings[0] ?? null,
    attributes: attributes[0] ?? null,
    category_state: categoryState,
    sessions,
    attempts,
    rating_history: ratingHistory,
    session_context: context,
    retention_card_state: cardState,
    reaction_calibration: rtCalibration[0] ?? null,
    category_baselines: baselines,
    reaction_runs: reactionRuns,
    day_notes: dayNotes,
    feedback_sent: myFeedback,
    spelling: spelling[0] ?? null,
    circle_memberships: circleMemberships,
    circles_created: circlesCreated
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="excogni-export-${stamp}.json"`
    }
  });
};
