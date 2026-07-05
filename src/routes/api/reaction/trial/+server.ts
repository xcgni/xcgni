import type { RequestHandler } from './$types';
import { ensureUser } from '$lib/server/auth';
import { pg } from '$lib/server/db';
import { touchUserSession } from '$lib/server/sessions';
import { reactionBand, reactionScoreFromBand, DEFAULT_CALIBRATION, type RtCalibration } from '$lib/server/reaction';
import { masteryToRating } from '$lib/server/retention';

// Receives a batch of measured RTs, converts each to an honest band using the
// user's calibration, aggregates to a band-of-bands, and stores a rating.
export const POST: RequestHandler = async ({ request, cookies }) => {
  const user = await ensureUser(cookies);
  const body = (await request.json().catch(() => ({}))) as { measuredMs?: number[] };
  const measured = (body.measuredMs ?? []).filter((x) => Number.isFinite(x) && x > 80 && x < 3000);
  if (measured.length === 0) {
    return new Response(JSON.stringify({ error: 'no valid trials' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const calRows = await pg`SELECT floor_ms, uncertainty_ms, refresh_hz FROM user_rt_calibration WHERE user_id = ${user.id}`;
  const cal: RtCalibration = calRows[0]
    ? { floorMs: calRows[0].floor_ms, uncertaintyMs: calRows[0].uncertainty_ms, refreshHz: calRows[0].refresh_hz }
    : DEFAULT_CALIBRATION;

  // best (fastest) trials define the user's reaction band; use median of fast third
  const sorted = [...measured].sort((a, b) => a - b);
  const fastThird = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 3)));
  const repMeasured = fastThird[Math.floor(fastThird.length / 2)];
  const band = reactionBand(repMeasured, cal);
  const score = reactionScoreFromBand(band);
  const rating = masteryToRating(score);

  // store rating under reaction_time slug for radar/records
  await pg`
    INSERT INTO user_category_state
      (user_id, category_slug, current_level, stable_level, rating, attempts_count, correct_count,
       peak_rating, peak_rating_at, updated_at)
    VALUES (${user.id}, 'reaction_time', 1, 1, ${rating}, ${measured.length}, ${measured.length}, ${rating}, now(), now())
    ON CONFLICT (user_id, category_slug) DO UPDATE SET
      rating = ${rating},
      attempts_count = user_category_state.attempts_count + ${measured.length},
      peak_rating = greatest(coalesce(user_category_state.peak_rating, 0), ${rating}),
      peak_rating_at = CASE WHEN ${rating} > coalesce(user_category_state.peak_rating, 0) THEN now() ELSE user_category_state.peak_rating_at END,
      updated_at = now()
  `;

  // Persist the raw per-trial series (Phase A, data-resolution plan): the band's raw material,
  // for variance and fatigue-slope insights later. Capped list, ints only.
  await pg`
    INSERT INTO reaction_runs (user_id, measured_ms, floor_ms, band_fast_ms, band_slow_ms)
    VALUES (${user.id}, ${measured.slice(0, 20).map((x) => Math.round(x))}, ${cal.floorMs ?? null}, ${band.fastMs}, ${band.slowMs})
  `;

  // BASELINE capture at reaction's calibration point (10 trials = 2 runs). Write-once.
  const stateNow = await pg`
    SELECT attempts_count FROM user_category_state
    WHERE user_id = ${user.id} AND category_slug = 'reaction_time'
  `;
  if ((stateNow[0]?.attempts_count ?? 0) >= 10) {
    await pg`
      INSERT INTO user_category_baseline (user_id, category_slug, rating, attempts_count)
      VALUES (${user.id}, 'reaction_time', ${rating}, ${stateNow[0].attempts_count})
      ON CONFLICT (user_id, category_slug) DO NOTHING
    `;
  }

  // A reaction run mid-mix is session activity - keep the open practice session alive.
  await touchUserSession(user.id);
  return new Response(JSON.stringify({ band, score, rating, calibrated: !!calRows[0], trials: measured.length }), {
    headers: { 'content-type': 'application/json' }
  });
};
